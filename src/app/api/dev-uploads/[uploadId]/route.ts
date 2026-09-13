import { isAdmin } from "@/lib/auth";
import { getLocalOptions } from "@/lib/repository";
import { receiveLocalUpload } from "@/lib/repository/local";

/**
 * Where the local store's upload targets point, so photos go straight from the browser into
 * `public/uploads/` during development. Against Supabase the browser uploads to Supabase itself
 * and there's nothing here to serve, so this answers as if the route didn't exist.
 */
export async function PUT(request: Request, { params }: { params: Promise<{ uploadId: string }> }) {
  const options = getLocalOptions();
  if (!options) return new Response("Not Found", { status: 404 });
  // Reachable by direct PUT, so it checks the session itself, as every action does.
  if (!(await isAdmin())) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { uploadId } = await params;
  const received = await receiveLocalUpload(options, uploadId, {
    bytes: new Uint8Array(await request.arrayBuffer()),
    // Charset and the like aren't part of the type the target was handed out for.
    contentType: (request.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase(),
  });

  if (received === "unknown-upload") return Response.json({ error: "That upload target is unknown or has expired." }, { status: 404 });
  if (received === "wrong-content-type") return Response.json({ error: "That file isn't the type this upload target was for." }, { status: 415 });
  return new Response(null, { status: 204 });
}
