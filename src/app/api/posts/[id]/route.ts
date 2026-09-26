import { NextRequest, NextResponse } from "next/server";
import { DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getApiUser } from "@/lib/supabase/api-auth";
import { r2Client, R2_BUCKET } from "@/lib/r2";
import { getUserRole, keyFromPublicUrl } from "@/lib/media";

// DELETE /api/posts/[id] — o'z postini (yoki admin bo'lsa istalganini) o'chirish
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user } = await getApiUser(request);
    if (!user) return NextResponse.json({ message: "Login kerak" }, { status: 401 });

    const { data: post } = await supabaseAdmin
      .from("posts")
      .select("id, trainer_id, images, video_url, video_thumbnail_url")
      .eq("id", params.id)
      .maybeSingle();

    if (!post) return NextResponse.json({ message: "Post topilmadi" }, { status: 404 });

    if (post.trainer_id !== user.id) {
      const role = await getUserRole(user.id);
      if (role !== "admin") return NextResponse.json({ message: "Ruxsat yo'q" }, { status: 403 });
    }

    const { error } = await supabaseAdmin.from("posts").delete().eq("id", params.id);
    if (error) throw error;

    // R2'dagi fayllarni tozalash (xato bo'lsa ham post allaqachon o'chgan — jim o'tamiz)
    try {
      const urls: string[] = [...(post.images || []), post.video_url, post.video_thumbnail_url].filter(Boolean);
      const keys = urls.map((u) => keyFromPublicUrl(u)).filter((k): k is string => !!k);
      if (keys.length > 0) {
        await r2Client.send(
          new DeleteObjectsCommand({ Bucket: R2_BUCKET, Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true } })
        );
      }
    } catch (e) {
      console.error("R2 cleanup error:", e);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Post delete:", error);
    return NextResponse.json({ message: "O'chirishda xatolik" }, { status: 500 });
  }
}
