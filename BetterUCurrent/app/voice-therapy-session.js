import VoiceTherapySession from '../utils/voice-therapy-session';
import React, { useEffect } from 'react';

// Wrapper component to add logging
const VoiceTherapySessionRoute = () => {
  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/6dcd3d57-b0cd-48d2-8a84-ff688642c485',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'voice-therapy-session.js:7',message:'Voice therapy route mounted',data:{componentLoaded:true},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
  }, []);
  
  return <VoiceTherapySession />;
};

export default VoiceTherapySessionRoute;

