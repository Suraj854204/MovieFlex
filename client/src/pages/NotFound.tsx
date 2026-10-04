import { Link } from 'react-router-dom';
import { EmptyState } from '../components/ui/Feedback';
import { useAuth } from '../context/AuthContext';

export default function NotFound() {
  const { user } = useAuth();
  return (
    <div className="center-page">
      <EmptyState icon="compass" title="Page not found" text="That page doesn't exist or has moved."
        action={<Link className="btn btn-primary" to={user ? '/home' : '/'}>{user ? 'Back to home' : 'Go to start'}</Link>} />
    </div>
  );
}
