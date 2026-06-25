import { AuthWrapper } from "@/components/auth-wrapper";
import WorkoutPage from "@/components/workout-page";

export default function AppHome() {
  return (
    <AuthWrapper>
      <WorkoutPage />
    </AuthWrapper>
  );
}
