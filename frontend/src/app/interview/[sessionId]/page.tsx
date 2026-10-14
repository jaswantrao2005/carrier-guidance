"use client";

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthContext';
import { InterviewRoom } from '@/components/ui/InterviewRoom';

export default function InterviewPage() {
  const { user, isLoading } = useAuth();
  const { sessionId } = useParams<{ sessionId: string }>();
  const router = useRouter();
  useEffect(() => {
    if (!isLoading && !user) router.replace('/login');
  }, [isLoading, user, router]);
  if (!user) return <p className="p-8 text-center">Loading your interview...</p>;
  return <InterviewRoom sessionId={sessionId} userId={user.id} candidateName={user.name} onFinish={id => router.replace(`/mock-interview/report/${id}`)} onLeave={() => router.push('/mock-interview')} />;
}
