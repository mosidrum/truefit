import { redirect } from "next/navigation";
import { getAppUser } from "@/lib/session";
import { getCvSummaries } from "@/lib/cvs";
import { buildProfileFromCvs } from "@/lib/profile";
import ProfileView from "./ProfileView";

export default async function ProfilePage() {
  const user = await getAppUser();
  if (!user) {
    redirect("/");
  }

  const [documents, profile] = await Promise.all([
    getCvSummaries(user.id),
    buildProfileFromCvs(user.id),
  ]);

  return <ProfileView user={user} documents={documents} profile={profile} />;
}
