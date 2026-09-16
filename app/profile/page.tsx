import { redirect } from "next/navigation";
import { getAppUser } from "@/lib/session";
import ProfileView from "./ProfileView";

export default async function ProfilePage() {
  const user = await getAppUser();
  if (!user) {
    redirect("/");
  }

  return <ProfileView user={user} />;
}
