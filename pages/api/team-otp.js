// Removed. The admin no longer sends an OTP when adding a member; team members get their OTP when they log in.
// You can safely delete this file.
export default function handler(req, res) {
    return res.status(404).json({ success: false, message: 'Not found' });
}
