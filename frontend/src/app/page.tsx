'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, FileText, Mic2, Save } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthContext';
import styles from './page.module.css';

const capabilities = [
  { label: 'Resume guidance', Icon: FileText },
  { label: 'Voice interviews', Icon: Mic2 },
  { label: 'Saved progress', Icon: Save },
];

export default function LandingPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user) router.replace('/dashboard');
  }, [isLoading, router, user]);

  if (user) return null;

  return (
    <section className={styles.shell} aria-labelledby="landing-heading">
      <div className={styles.ambient} aria-hidden="true" />
      <div className={styles.layout}>
        <div className={styles.copy}>
          <p className={styles.eyebrow}>
            <span className={styles.eyebrowMark} aria-hidden="true" />
            A clearer way forward
          </p>

          <h1 id="landing-heading" className={styles.heading}>
            Practice for the career you <span>see for yourself.</span>
          </h1>

          <p className={styles.description}>
            Understand your resume, plan your next steps, and rehearse the
            conversation with a voice-first AI interviewer.
          </p>

          <div className={styles.actions}>
            <Link href="/register" className={styles.primaryAction}>
              Get started <ArrowRight size={18} strokeWidth={2.2} aria-hidden="true" />
            </Link>
            <Link href="/login" className={styles.secondaryAction}>
              Log in
            </Link>
          </div>

          <ul className={styles.capabilities} aria-label="What you can do">
            {capabilities.map(({ label, Icon }) => (
              <li key={label}>
                <Icon size={15} strokeWidth={1.9} aria-hidden="true" />
                <span>{label}</span>
              </li>
            ))}
          </ul>
        </div>

        <figure className={styles.preview}>
          <div className={styles.previewFrame}>
            <div className={styles.previewChrome} aria-hidden="true">
              <span className={styles.windowDots}><i /><i /><i /></span>
              <span>CareerAI / practice interview</span>
            </div>
            <div className={styles.previewViewport}>
              <Image
                src="/images/interview-room-desktop.png"
                alt="CareerAI practice interview with Alex, an animated AI interviewer, and controls for speaking, captions, and typing."
                width={1440}
                height={1000}
                priority
                sizes="(max-width: 700px) 150vw, (max-width: 1100px) 100vw, 75vw"
                className={styles.previewImage}
              />
            </div>
          </div>
          <figcaption className={styles.previewCaption}>
            <span className={styles.previewPulse} aria-hidden="true" />
            A real look inside your practice room
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
