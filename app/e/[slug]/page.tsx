import { notFound, redirect } from "next/navigation";
import { getAlbumBySlug } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function FriendlyEventPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ upload?: string }> }) {
  const { slug } = await params;
  const query = await searchParams;
  const album = await getAlbumBySlug(slug);
  if (!album) notFound();
  redirect(`/g/${album.access_token}${query.upload === "1" ? "?upload=1" : ""}`);
}
