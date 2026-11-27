import { useEffect, useRef, useState } from 'react';
import { videoToJpeg, canUseCamera } from '../lib/photo';

// Takes a photo with the camera of the computer (a phone uses its own camera app instead). Asks the browser for permission.
export default function CameraCapture({ onCapture, onClose }) {
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const [msg, setMsg] = useState('Opening the camera...');
    const [ready, setReady] = useState(false);

    const stop = () => {
        if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    };

    useEffect(() => {
        let cancelled = false;
        (async () => {
            if (!canUseCamera()) { setMsg('This browser cannot open the camera. Please use "Upload photo".'); return; }
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
                if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
                streamRef.current = stream;
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    try { await videoRef.current.play(); } catch (e) { /* some browsers start it by themselves */ }
                }
                setReady(true);
                setMsg('');
            } catch (e) {
                setMsg(e && e.name === 'NotAllowedError'
                    ? 'The camera was not allowed. Allow the camera in the browser, or use "Upload photo".'
                    : 'No camera was found. Please use "Upload photo".');
            }
        })();
        return () => { cancelled = true; stop(); };
    }, []);

    const snap = async () => {
        try {
            const file = await videoToJpeg(videoRef.current);
            stop();
            onCapture(file);
        } catch (e) {
            setMsg('Could not take the photo, please try again.');
        }
    };
    const close = () => { stop(); onClose(); };

    return (
        <div className="td-overlay" role="dialog" aria-modal="true" aria-label="Take photo" style={{ zIndex: 110 }} onMouseDown={(e) => e.target === e.currentTarget && close()}>
            <div className="td-modal" style={{ maxWidth: 420 }}>
                <div className="td-modal-head">
                    <h2>Take photo</h2>
                    <button type="button" className="td-close" onClick={close} aria-label="Close">×</button>
                </div>
                {msg && <div className="msg" style={{ margin: '0 0 10px' }}>{msg}</div>}
                <video ref={videoRef} playsInline muted style={{ width: '100%', borderRadius: 16, background: '#101828', transform: 'scaleX(-1)', display: ready ? 'block' : 'none' }} />
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 12 }}>
                    <button type="button" className="td-btn td-btn-gray" onClick={close}>Cancel</button>
                    <button type="button" className="td-btn td-btn-primary" onClick={snap} disabled={!ready}>Take photo</button>
                </div>
            </div>
        </div>
    );
}
