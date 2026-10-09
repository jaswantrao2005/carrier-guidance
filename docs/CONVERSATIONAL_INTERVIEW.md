# Conversational interview

The room presents Alex as a visible animated AI practice interviewer. Joining starts a separate greeting and readiness check before the first scored question. The candidate can choose Ready to begin or A little nervous. Alex responds, then begins the interview. This warm-up is never submitted as an interview answer. Existing sessions with saved answers resume their current question.

The conversation engine chooses when to probe and when to move on. A substantive but incomplete answer can receive one focused follow-up on the same topic. Explicit skips, uncertainty and filler move on gently. Introduction and closing topics are not probed. The existing question budget still reserves room for the closing topic.

Acknowledgements are built from the actual saved answer rather than invented model memory. The model receives the previous question, answer and a specific follow-up intent. It returns the actual question separately from the greeting and acknowledgement. Coding interviews retain their server-owned task and distinguish prose explanations from code submissions.

The interface preserves submitted conversation, local answer/code drafts, pause/resume, recording consent and report retries. The video-call view makes the interviewer and microphone controls primary. Captions, typing and transcript review are optional. Skip sends one skipped turn, with confirmation before replacing an unfinished answer. Coding tasks retain their editor and code runner.

Interviewer voice is optional and starts only after an explicit joining/playback gesture. Natural speech uses the existing server-side Gemini key and the speech model `gemini-3.8-flash-lite-tts`, with Kore as the voice. The server owns the spoken text and validates session ownership and question sequence. It returns bounded WAV audio and matching captions, caches repeats briefly, and never exposes the key to the browser. Browser English voices are a fallback.

The locally bundled CC0 human model uses soft portrait lighting, subtle gaze/blinks and a bounded mouth movement driven by actual playback amplitude. This is a rendered AI avatar, with approximate mouth movement rather than phoneme-perfect generated video. Replay/stop and caption-only continuation remain available. Playback stops before microphone capture and navigation; stopping also invalidates any pending audio response.

Speak answer explicitly enables the microphone. Finish answer ends capture, transcribes the clip through Gemini and submits the recognized words once. The app keeps the current clip in memory for a retry, up to two minutes, and does not persist it as an interview recording. The separate consented recording feature is unchanged. Automatic listening after subsequent questions requires that prior microphone activation and normally completed question playback; mute, typing and navigation cancel capture. This avoids recording Alex's own speech. The interface shows transcription/loading errors and keeps typing available. Browser speech recognition is an optional alternative; a real Chrome probe detected speech but returned no transcript, so the primary path uses the tested Gemini audio service.

## Research used

- [Google conversation greetings](https://developers.google.com/assistant/conversation-design/greetings): welcome the user, set expectations and give them control.
- [Google conversation questions](https://developers.google.com/assistant/conversation-design/questions): one question at a time and clear turn-taking.
- [Google acknowledgements](https://developers.google.com/assistant/conversation-design/acknowledgements): acknowledge the previous turn before continuing.
- [MDN available synthesis voices](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis/getVoices) and [voice-list changes](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis/voiceschanged_event): use the device's actual voice list and update it as voices become available.
- [Gemini speech generation](https://ai.google.dev/gemini-api/docs/speech-generation) and [Interactions API](https://ai.google.dev/gemini-api/docs/interactions-overview): generate natural spoken audio through the existing backend provider credentials.
- [Gemini audio understanding](https://ai.google.dev/gemini-api/docs/generate-content/audio): transcribe a completed microphone clip while preserving the spoken wording. The server checks ownership and question sequence before and after the provider response.
- [MDN SpeechRecognition stop](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/stop) and [abort](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/abort): finishing waits for final words; cancellation discards pending recognition callbacks.
- [TalkingHead official asset documentation](https://github.com/met4citizen/TalkingHead/blob/main/README.md): the bundled MPFB human avatar is CC0 and has facial animation targets. Local source attribution is in `frontend/public/interviewer/README.md`.

These sources informed the interaction. They do not validate the accuracy of interview scoring or guarantee that a particular voice sounds human.

## Verification

Implementation checks and the live rehearsal results are recorded in [VERIFICATION.md](VERIFICATION.md). Checks distinguish actual Gemini text/audio generation, native audio playback, and simulated browser fallback/cancellation events.
