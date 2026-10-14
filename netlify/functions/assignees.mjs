import { getStore } from "@netlify/blobs";

// 담당자 명단을 Netlify Blobs에 저장합니다. 모든 회원이 같은 명단을 봅니다.
// 수정은 Netlify 환경변수 EDIT_PIN(관리자 비밀번호)을 아는 사람만 가능합니다.
export default async (req) => {
  const store = getStore("noguesu-study");
  const pin = process.env.EDIT_PIN || "";
  const load = async () => (await store.get("assignees", { type: "json" })) || {};

  if (req.method === "GET") {
    return Response.json({ data: await load() }, { headers: { "Cache-Control": "no-store" } });
  }
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });

  let body;
  try { body = await req.json(); } catch { return new Response("bad request", { status: 400 }); }
  if (!pin) return new Response("EDIT_PIN not set", { status: 503 });
  if (String(body.pin || "") !== pin) {
    await new Promise(r => setTimeout(r, 800)); // 비밀번호 마구 대입 늦추기
    return new Response("forbidden", { status: 403 });
  }
  if (body.action === "verify") return Response.json({ ok: true });

  const no = String(body.no || "");
  if (!/^\d{1,3}$/.test(no)) return new Response("bad no", { status: 400 });
  const name = String(body.name || "").trim().slice(0, 30);
  const data = await load();
  data[no] = name;
  await store.setJSON("assignees", data);
  return Response.json(data);
};

export const config = { path: "/api/assignees" };
