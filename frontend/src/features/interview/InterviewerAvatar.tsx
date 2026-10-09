"use client";

import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { Box3, Color, DirectionalLight, Group, HemisphereLight, Mesh, MeshStandardMaterial, Object3D, PerspectiveCamera, Quaternion, Scene, SRGBColorSpace, Vector3, WebGLRenderer, ACESFilmicToneMapping } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

interface Props {
  amplitude: MutableRefObject<number>;
  speaking: boolean;
  browserSpeech: boolean;
  onReady: (available: boolean) => void;
}

function dispose(root: Object3D) {
  root.traverse(object => {
    if (!(object instanceof Mesh)) return;
    object.geometry.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      for (const value of Object.values(material)) {
        if (value && typeof value === 'object' && 'isTexture' in value && 'dispose' in value && typeof value.dispose === 'function') value.dispose();
      }
      material.dispose();
    }
  });
}

export default function InterviewerAvatar({ amplitude, speaking, browserSpeech, onReady }: Props) {
  const host = useRef<HTMLDivElement | null>(null);
  const state = useRef({ amplitude, speaking, browserSpeech, onReady });
  state.current = { amplitude, speaking, browserSpeech, onReady };
  const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading');

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let alive = true; let frame = 0; let model: Group | null = null;
    let loadingTimer: ReturnType<typeof setTimeout> | null = null;
    let renderer: WebGLRenderer | null = null;
    const scene = new Scene();
    const camera = new PerspectiveCamera(27, 1, 0.05, 30);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let head: Object3D | undefined;
    let headRest = new Vector3();
    const targets: Mesh[] = [];
    let nextBlink = 2.8; let blinkStart = -10; let start = performance.now(); let previousFrame = start;
    let nextGlance = 5.2; let gazeX = 0; let gazeY = 0; let gazeTargetX = 0; let gazeTargetY = 0; let jaw = 0;
    const fail = () => {
      if (!alive) return;
      if (loadingTimer) clearTimeout(loadingTimer); loadingTimer = null;
      setStatus('unavailable'); state.current.onReady(false);
      if (frame) cancelAnimationFrame(frame);
    };
    const resize = () => {
      if (!renderer) return;
      const width = element.clientWidth; const height = element.clientHeight;
      if (!width || !height) return;
      camera.aspect = width / height; camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
      if (model) renderer.render(scene, camera);
    };
    const observer = new ResizeObserver(resize);
    const visibility = () => {
      if (document.hidden) { if (frame) cancelAnimationFrame(frame); frame = 0; }
      else if (model && !frame) { start = performance.now(); previousFrame = start; nextBlink = 2.8; nextGlance = 5.2; blinkStart = -10; frame = requestAnimationFrame(draw); }
    };
    const morph = (mesh: Mesh, name: string, amount: number) => {
      const index = mesh.morphTargetDictionary?.[name];
      if (index !== undefined && mesh.morphTargetInfluences) mesh.morphTargetInfluences[index] = amount;
    };
    const draw = (now: number) => {
      frame = 0;
      if (!alive || !renderer || !model || document.hidden) return;
      const time = (now - start) / 1000;
      const elapsed = Math.min(0.05, Math.max(0, (now - previousFrame) / 1000)); previousFrame = now;
      if (!reduced.matches && time >= nextBlink) { blinkStart = time; nextBlink = time + 3.8 + Math.random() * 2.3; }
      const blink = reduced.matches ? 0 : Math.max(0, Math.sin(Math.min(1, Math.max(0, (time - blinkStart) / 0.18)) * Math.PI));
      if (!reduced.matches && time >= nextGlance) {
        // Brief, irregular changes in attention, with most time looking toward the camera.
        const away = Math.random() > 0.6;
        gazeTargetX = away ? (Math.random() - 0.5) * 0.06 : 0;
        gazeTargetY = away ? (Math.random() - 0.5) * 0.02 : 0;
        nextGlance = time + 3 + Math.random() * 4;
      }
      const glanceBlend = 1 - Math.exp(-elapsed * 3);
      gazeX += ((reduced.matches ? 0 : gazeTargetX) - gazeX) * glanceBlend;
      gazeY += ((reduced.matches ? 0 : gazeTargetY) - gazeY) * glanceBlend;
      // Native browser speech exposes no PCM; its subtle mouth movement is approximate.
      const speechLevel = state.current.browserSpeech ? 0.14 + Math.abs(Math.sin(time * 11)) * 0.17 : state.current.amplitude.current;
      const mouth = state.current.speaking ? Math.min(0.26, Math.max(0, speechLevel - 0.012) * 0.4) : 0;
      jaw += (mouth - jaw) * (1 - Math.exp(-elapsed * (mouth > jaw ? 22 : 30)));
      if (!state.current.speaking && jaw < 0.001) jaw = 0;
      for (const mesh of targets) {
        // Both targets contain jaw/inner-mouth deformation in this model. Combining
        // them exaggerates the opening and exposes the tongue, so drive only one.
        morph(mesh, 'jawOpen', jaw);
        morph(mesh, 'viseme_aa', 0); morph(mesh, 'tongueOut', 0);
        morph(mesh, 'eyeBlinkLeft', blink); morph(mesh, 'eyeBlinkRight', blink);
        morph(mesh, 'mouthSmileLeft', 0.035); morph(mesh, 'mouthSmileRight', 0.035);
        morph(mesh, 'eyeLookInLeft', Math.max(0, gazeX)); morph(mesh, 'eyeLookOutRight', Math.max(0, gazeX));
        morph(mesh, 'eyeLookOutLeft', Math.max(0, -gazeX)); morph(mesh, 'eyeLookInRight', Math.max(0, -gazeX));
        morph(mesh, 'eyeLookUpLeft', Math.max(0, gazeY)); morph(mesh, 'eyeLookUpRight', Math.max(0, gazeY));
        morph(mesh, 'eyeLookDownLeft', Math.max(0, -gazeY)); morph(mesh, 'eyeLookDownRight', Math.max(0, -gazeY));
      }
      if (head) {
        const breath = reduced.matches ? 0 : Math.sin(time * 1.3) * 0.002;
        head.rotation.set(headRest.x + gazeY * 0.25 + breath, headRest.y + gazeX * 0.3, headRest.z + breath * 0.4);
      }
      renderer.render(scene, camera);
      frame = requestAnimationFrame(draw);
    };
    try {
      renderer = new WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
      renderer.outputColorSpace = SRGBColorSpace; renderer.toneMapping = ACESFilmicToneMapping; renderer.toneMappingExposure = 0.95;
      renderer.setClearColor(new Color('#e7e3dd'), 0);
      renderer.domElement.setAttribute('aria-label', 'Alex, animated AI practice interviewer');
      renderer.domElement.setAttribute('role', 'img');
      renderer.domElement.dataset.testid = 'interviewer-avatar-canvas';
      renderer.domElement.addEventListener('webglcontextlost', fail);
      element.appendChild(renderer.domElement);
      // A window-like key preserves the skin texture; low fill retains facial depth.
      scene.add(new HemisphereLight('#fff9f1', '#74717a', 0.65));
      const key = new DirectionalLight('#fff5eb', 2.1); key.position.set(-2.5, 2.7, 3.5); scene.add(key);
      const fill = new DirectionalLight('#eef2ff', 0.45); fill.position.set(3, 1.8, 2); scene.add(fill);
      const rim = new DirectionalLight('#fff4e8', 0.65); rim.position.set(1, 2.6, -2); scene.add(rim);
      observer.observe(element); resize();
      document.addEventListener('visibilitychange', visibility);
      loadingTimer = setTimeout(fail, 20000);
      new GLTFLoader().load('/interviewer/alex.glb', gltf => {
        if (!alive) { dispose(gltf.scene); return; }
        if (loadingTimer) clearTimeout(loadingTimer); loadingTimer = null;
        model = gltf.scene; scene.add(model);
        model.updateMatrixWorld(true);
        model.traverse(object => {
          if (!(object instanceof Mesh)) return;
          if (object.morphTargetDictionary) targets.push(object);
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          for (const material of materials) {
            if (!(material instanceof MeshStandardMaterial)) continue;
            // Keep the original textured skin, hair, eyes and clothing normal map.
            if (material.name === 'Human.body') { material.roughness = 0.64; material.metalness = 0; }
            else if (material.name === 'Human.high-poly') material.roughness = 0.38;
            else if (material.name === 'Human.teeth_base') material.roughness = 0.6;
            else if (material.name.includes('eyebrows') || material.name.includes('eyelashes')) { material.color.set('#28201e'); material.roughness = 0.9; }
            else if (material.name === 'Human.ponytail01') material.roughness = 0.8;
          }
          if (object.name.includes('female_casualsuit01') && object.material instanceof MeshStandardMaterial) {
            const original = object.material; const fabric = original.clone();
            fabric.map = null; fabric.color.set('#26354d'); fabric.roughness = 0.85;
            object.material = fabric; original.map?.dispose(); original.dispose();
          }
        });
        for (const [name, side] of [['LeftArm', 0.06], ['RightArm', -0.06]] satisfies [string, number][]) {
          const arm = model.getObjectByName(name);
          if (!arm?.parent) continue;
          const parentInverse = arm.parent.getWorldQuaternion(new Quaternion()).invert();
          const direction = new Vector3(side, -1, 0.12).normalize().applyQuaternion(parentInverse);
          arm.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), direction);
        }
        model.updateMatrixWorld(true);
        head = model.getObjectByName('Head');
        const center = new Vector3();
        if (head) { head.getWorldPosition(center); headRest = new Vector3(head.rotation.x, head.rotation.y, head.rotation.z); }
        else { const box = new Box3().setFromObject(model); box.getCenter(center); center.y = box.max.y - (box.max.y - box.min.y) * 0.12; }
        // A head-and-shoulders camera, rather than the model's full-body neutral pose.
        camera.position.set(center.x, center.y + 0.105, center.z + 1.16);
        camera.lookAt(center.x, center.y + 0.035, center.z);
        resize(); setStatus('ready'); state.current.onReady(true);
        frame = requestAnimationFrame(draw);
      }, undefined, fail);
    } catch { fail(); }
    return () => {
      alive = false; observer.disconnect(); document.removeEventListener('visibilitychange', visibility);
      if (loadingTimer) clearTimeout(loadingTimer);
      if (frame) cancelAnimationFrame(frame);
      if (model) dispose(model);
      if (renderer) {
        renderer.domElement.removeEventListener('webglcontextlost', fail);
        renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
      }
    };
  }, []);

  return <div className="absolute inset-0">
    <div ref={host} className={`h-full w-full ${status === 'ready' ? 'opacity-100' : 'opacity-0'}`} />
    {status === 'loading' && <div role="status" className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-sm text-slate-700"><span className="h-7 w-7 animate-spin rounded-full border-2 border-slate-300 border-t-primary-600 motion-reduce:animate-none" />Alex is getting ready...</div>}
    {status === 'unavailable' && <div className="absolute inset-0"><img src="/interviewer/alex-still.png" alt="Still portrait of Alex, the AI practice interviewer" className="h-full w-full object-cover" /><span className="absolute right-3 top-4 rounded-md bg-white/90 px-2 py-1 text-[10px] font-medium text-slate-700">Still portrait</span><p role="status" className="absolute inset-x-3 bottom-20 rounded-lg bg-white/95 p-2 text-center text-xs leading-5 text-slate-700">Animation is unavailable. Voice and captions still work.</p></div>}
  </div>;
}
