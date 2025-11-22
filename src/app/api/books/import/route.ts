import { NextRequest, NextResponse } from "next/server";
import { importLocalBook } from "../../../../lib/server/books";
import { isSupabaseEnabled } from "../../../../lib/supabase-enabled";
import { createServerSupabase } from "../../../../lib/supabase-server";

export async function POST(req: NextRequest) {
  if (!isSupabaseEnabled)
    return NextResponse.json({ disabled: true }, { status: 400 });
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const payload = await req.json();
  try {
    const result = await importLocalBook(user.id, payload.book);
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
