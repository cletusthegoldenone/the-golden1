import { redirect } from 'next/navigation';

/**
 * /home redirects to the landing page at /.
 */
export default function HomePage() {
  redirect('/');
}
