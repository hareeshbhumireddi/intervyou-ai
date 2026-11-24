import { Navigate } from 'react-router-dom';

/**
 * Practice page has been streamlined: users selecting "Practice" now go
 * directly into the interview setup wizard (sector selection) without the
 * intermediate teaser page.
 */
export default function PracticePage() {
  return <Navigate to="/setup" replace />;
}