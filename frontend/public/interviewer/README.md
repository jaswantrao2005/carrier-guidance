# Alex interview avatar

`alex.glb` is the MPFB human avatar from the official TalkingHead repository.

- Source: https://github.com/met4citizen/TalkingHead/blob/6318ff8c798e4a661fcd70c9373c4ab789c822bb/avatars/mpfb.glb
- Original filename: `avatars/mpfb.glb`
- Git blob SHA-1: `cd2ebbe1fe8bcbf3d5b2dfbf1262a7f76814e68f`
- Original size: 36,815,920 bytes
- License: CC0, as stated specifically for `mpfb.glb` in the asset attribution section: https://github.com/met4citizen/TalkingHead/blob/main/README.md

This app uses the model only. It does not import the TalkingHead library. The local Three.js scene uses the original facial morph targets for blinking and audio-amplitude-based mouth movement. Alex is a synthetic AI interviewer, not a live human or a generated video stream. Mouth movement approximates sound amplitude rather than individual phonemes. Browser speech fallback has no accessible audio amplitude, so it uses subtle approximate mouth movement only between real speech start and end events.

The original GLB remains unchanged. At runtime, its clothing material is changed to plain navy, preserving its normal map, and its arms are posed at rest. The original skin, eye and hair color textures remain in use. A soft side key, low fill and lower exposure preserve facial shading and skin texture; skin roughness is adjusted without inventing photographic detail. The camera frames Alex at eye level with a closer head-and-shoulders composition.

Speech drives one smoothed `jawOpen` channel capped at 0.26. The model's overlapping `viseme_aa` deformation and `tongueOut` are held at zero to avoid an exaggerated mouth or exposed tongue. Subtle irregular gaze changes and blinks accompany the idle pose; reduced-motion preferences disable these extra movements. This remains approximate amplitude-driven animation, not phoneme-synchronized video.

`alex-still.png` is an actual local canvas render of this same model, camera, lighting and pose. Its wide framing allows narrower video stages to crop the neutral background while retaining the face. It is used as an explicitly labelled still if WebGL cannot render.
