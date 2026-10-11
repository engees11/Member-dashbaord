import { useRouter } from 'next/router';
import AppShell from '../components/AppShell';
import '../styles/globals.css';
import '../styles/otp.css';
import '../styles/shell.css';

export default function App({ Component, pageProps }) {
    const { pathname } = useRouter();
    // every /admin page gets the dark menu and top bar (the emergency page /admin-login does not)
    const inShell = pathname === '/admin' || pathname.startsWith('/admin/');
    return inShell ? (
        <AppShell><Component {...pageProps} /></AppShell>
    ) : (
        <Component {...pageProps} />
    );
}
