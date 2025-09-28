export type RealtimeHandle = {
  stop: () => void;
  isActive: () => boolean;
};

export async function startRealtimeVoice(audioEl: HTMLAudioElement): Promise<RealtimeHandle> {
  let pc: RTCPeerConnection | null = null;
  let localStream: MediaStream | null = null;

  try {
    // 1) Get ephemeral token for WebRTC from our backend
    const response = await fetch("/api/openai/realtime/token", { 
      method: "POST",
      credentials: 'include' // Include session cookies
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(`Failed to get realtime token: ${errorData.error || response.statusText}`);
    }
    
    const sessionData = await response.json();
    const EPHEMERAL_KEY = sessionData?.client_secret?.value;
    
    if (!EPHEMERAL_KEY) {
      throw new Error("No ephemeral key received from server");
    }

    console.log('[Realtime] Ephemeral token obtained successfully');

    // 2) Create RTCPeerConnection
    pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
      ]
    });

    // 3) Play remote audio when received
    pc.ontrack = (event) => {
      console.log('[Realtime] Received remote audio track');
      // OpenAI sends an audio track; attach it to our <audio> element
      if (audioEl.srcObject !== event.streams[0]) {
        audioEl.srcObject = event.streams[0];
        audioEl.play().catch((error) => {
          console.warn('[Realtime] Audio autoplay failed:', error);
        });
      }
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      console.log('[Realtime] Connection state:', pc?.connectionState);
    };

    pc.oniceconnectionstatechange = () => {
      console.log('[Realtime] ICE connection state:', pc?.iceConnectionState);
    };

    // 4) Capture microphone (audio only). Must be triggered by a user gesture.
    localStream = await navigator.mediaDevices.getUserMedia({ 
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 24000 // Optimal for OpenAI Realtime
      }, 
      video: false 
    });

    console.log('[Realtime] Microphone access granted');

    // Add local audio tracks to the peer connection
    for (const track of localStream.getTracks()) {
      pc.addTrack(track, localStream);
    }

    // 5) Create data channel for optional events (OpenAI Realtime supports this)
    const dataChannel = pc.createDataChannel("oai-events", {
      ordered: true
    });

    dataChannel.onopen = () => {
      console.log('[Realtime] Data channel opened');
    };

    dataChannel.onmessage = (event) => {
      console.log('[Realtime] Data channel message:', event.data);
    };

    // 6) Create an SDP offer
    const offer = await pc.createOffer({ 
      offerToReceiveAudio: true, 
      offerToReceiveVideo: false 
    });
    await pc.setLocalDescription(offer);

    console.log('[Realtime] Created SDP offer');

    // 7) Send offer to OpenAI's Realtime WebRTC endpoint
    const baseUrl = "https://api.openai.com/v1/realtime";
    const model = "gpt-4o-realtime-preview-2024-12-17";
    const realtimeResponse = await fetch(`${baseUrl}?model=${encodeURIComponent(model)}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${EPHEMERAL_KEY}`,
        "Content-Type": "application/sdp",
        "Accept": "application/sdp",
        "OpenAI-Beta": "realtime=v1",
      },
      body: offer.sdp,
    });

    if (!realtimeResponse.ok) {
      const errorText = await realtimeResponse.text();
      throw new Error(`OpenAI Realtime handshake failed: ${errorText}`);
    }

    console.log('[Realtime] OpenAI handshake successful');

    // 8) Apply remote SDP answer
    const answerSdp = await realtimeResponse.text();
    const answer = { type: "answer" as const, sdp: answerSdp };
    await pc.setRemoteDescription(answer);

    console.log('[Realtime] WebRTC connection established');

    // Send automatic greeting after connection is ready
    const sendAutoGreeting = async () => {
      try {
        // Wait a moment for the connection to stabilize
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Get user name from auth for personalized greeting
        let userName = 'there';
        try {
          const response = await fetch('/api/auth/user');
          if (response.ok) {
            const userData = await response.json();
            userName = userData.name?.split(' ')[0] || userData.email?.split('@')[0] || 'there';
          }
        } catch (error) {
          console.warn('[Realtime] Could not fetch user name for greeting:', error);
        }

        // Send greeting message over the data channel (if available) or through the session
        // This triggers OpenAI to generate speech for the greeting
        const greetingMessage = {
          type: 'response.create',
          response: {
            modalities: ['audio'],
            instructions: `Say a brief, friendly greeting to ${userName}. Something like "Hey ${userName}! I'm Opus, your AI companion. How can I help you today?" Keep it short and natural.`
          }
        };

        // Try to send via data channel if available
        if (pc) {
          const dataChannel = pc.createDataChannel('messages');
          if (dataChannel.readyState === 'open') {
            dataChannel.send(JSON.stringify(greetingMessage));
            console.log('[Realtime] Sent automatic greeting via data channel');
          } else {
            // Fallback: the greeting will happen naturally through conversation
            console.log('[Realtime] Data channel not ready, greeting will happen naturally');
          }
        }
      } catch (error) {
        console.warn('[Realtime] Failed to send automatic greeting:', error);
        // Not critical - the conversation can still proceed
      }
    };

    // Send the greeting asynchronously
    sendAutoGreeting();

    // Return control interface
    const stop = () => {
      try {
        console.log('[Realtime] Stopping voice session');
        
        // Stop all local tracks
        pc?.getSenders().forEach(sender => {
          if (sender.track) {
            sender.track.stop();
          }
        });
        
        localStream?.getTracks().forEach(track => track.stop());
        
        // Close peer connection
        pc?.close();
        
        // Clear audio element
        if (audioEl) {
          audioEl.pause();
          audioEl.srcObject = null;
        }
      } catch (error) {
        console.warn('[Realtime] Error during cleanup:', error);
      } finally {
        pc = null;
        localStream = null;
      }
    };

    const isActive = () => !!pc && pc.connectionState !== 'closed' && pc.connectionState !== 'failed';

    return { stop, isActive };

  } catch (error) {
    // Cleanup on error
    try {
      pc?.getSenders().forEach(sender => sender.track?.stop());
      localStream?.getTracks().forEach(track => track.stop());
      pc?.close();
    } catch {} // Ignore cleanup errors
    
    console.error('[Realtime] Failed to start voice session:', error);
    throw error;
  }
}