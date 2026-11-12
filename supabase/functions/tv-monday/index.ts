// "FUP pendente": conta, só no grupo Tarefas Pendentes de cada quadro (pausadas, finalizadas etc. ficam de fora),
// quantos itens ainda não receberam comentário humano HOJE (fuso de São Paulo), por pessoa.
// - Pietra, Rhany, Carol e Jana: quadros Produção, Financeiro Inicial e Financeiro Final, pela coluna "Delivery FUP".
// - Helo: quadros Contrato, Auditorias e QC, pela coluna de pessoas "Delivery".
// Comentários automáticos (sem autor ou começando com 🤖) não contam.
import { createClient } from "jsr:@supabase/supabase-js@2";

const GRUPO = "topics"; // Tarefas Pendentes
const QUARTETO = ["Pietra", "Rhany", "Carol", "Jana"];
const QUADROS = [
  { id: 18303087624, nome: "Produção", coluna: "lookup_mm6bfsyr", pessoas: QUARTETO },
  { id: 18325634208, nome: "Financeiro Inicial", coluna: "lookup_mm6b602a", pessoas: QUARTETO },
  { id: 18379293104, nome: "Financeiro Final", coluna: "lookup_mm6bkd7k", pessoas: QUARTETO },
  { id: 18302830187, nome: "Contrato", coluna: "dup__of_an_lise__1", pessoas: ["Helo"] },
  { id: 18301018151, nome: "Auditorias", coluna: "dup__of_an_lise__1", pessoas: ["Helo"] },
  { id: 18303271824, nome: "QC", coluna: "dup__of_an_lise__1", pessoas: ["Helo"] },
];
const PESSOAS: { nome: string; busca: string }[] = [
  { nome: "Pietra", busca: "pietra" },
  { nome: "Rhany", busca: "rhaniery" },
  { nome: "Carol", busca: "caroline" },
  { nome: "Jana", busca: "janayna" },
  { nome: "Helo", busca: "helo" },
];
const CACHE_SEGUNDOS = 180;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function hojeSP(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}
function diaSP(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(iso));
}

async function monday(query: string, variables: Record<string, unknown>) {
  const r = await fetch("https://api.monday.com/v2", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: Deno.env.get("MONDAY_TOKEN") ?? "",
      "API-Version": "2025-04",
    },
    body: JSON.stringify({ query, variables }),
  });
  const j = await r.json();
  if (j.errors) throw new Error(JSON.stringify(j.errors));
  return j.data;
}

const campos = (col: string) => `items { id name updates(limit: 10) { created_at text_body creator { id } }
  column_values(ids: ["${col}"]) { text ... on MirrorValue { display_value } } }`;

async function itensDoQuadro(q: (typeof QUADROS)[number]) {
  const itens: any[] = [];
  let d = await monday(
    `query($b:[ID!]){ boards(ids:$b){ groups(ids:["${GRUPO}"]){ items_page(limit:100){ cursor ${campos(q.coluna)} } } } }`,
    { b: [q.id] },
  );
  let page = d.boards[0].groups[0].items_page;
  itens.push(...page.items);
  while (page.cursor) {
    d = await monday(`query($c:String!){ next_items_page(cursor:$c, limit:100){ cursor ${campos(q.coluna)} } }`, { c: page.cursor });
    page = d.next_items_page;
    itens.push(...page.items);
  }
  return itens.map((it) => ({ ...it, quadro: q.nome, pessoasDoQuadro: q.pessoas }));
}

async function calcular() {
  const hoje = hojeSP();
  const itens = (await Promise.all(QUADROS.map(itensDoQuadro))).flat();

  const porPessoa: Record<string, { sem: number; total: number; projetos: string[] }> = {};
  for (const p of PESSOAS) porPessoa[p.nome] = { sem: 0, total: 0, projetos: [] };
  const porQuadro: Record<string, { sem: number; total: number }> = {};
  for (const q of QUADROS) porQuadro[q.nome] = { sem: 0, total: 0 };
  let totalSem = 0, totalProjetos = 0;

  for (const it of itens) {
    const cv = it.column_values?.[0] ?? {};
    const quem = String(cv.display_value ?? cv.text ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const donos = PESSOAS.filter((p) => it.pessoasDoQuadro.indexOf(p.nome) >= 0 && quem.indexOf(p.busca) >= 0);
    if (!donos.length) continue;
    const comentouHoje = (it.updates ?? []).some((u: any) =>
      u.creator && u.creator.id && !String(u.text_body ?? "").trim().startsWith("🤖") && diaSP(u.created_at) === hoje
    );
    totalProjetos++;
    porQuadro[it.quadro].total++;
    if (!comentouHoje) { totalSem++; porQuadro[it.quadro].sem++; }
    for (const p of donos) {
      porPessoa[p.nome].total++;
      if (!comentouHoje) { porPessoa[p.nome].sem++; porPessoa[p.nome].projetos.push(it.quadro + " · " + it.name); }
    }
  }
  return {
    dia: hoje,
    total_sem_comentario: totalSem,
    total_projetos: totalProjetos,
    pessoas: PESSOAS.map((p) => ({ nome: p.nome, ...porPessoa[p.nome] })),
    quadros: QUADROS.map((q) => ({ nome: q.nome, ...porQuadro[q.nome] })),
    calculado_em: new Date().toISOString(),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    const { data: cache } = await sb.from("tv_monday_cache").select("dados, atualizado_em").eq("id", 1).maybeSingle();
    if (
      cache && Date.now() - new Date(cache.atualizado_em).getTime() < CACHE_SEGUNDOS * 1000 &&
      cache.dados?.dia === hojeSP() && cache.dados?.quadros?.length === QUADROS.length
    ) {
      return new Response(JSON.stringify(cache.dados), { headers: { ...cors, "Content-Type": "application/json" } });
    }
    const dados = await calcular();
    await sb.from("tv_monday_cache").upsert({ id: 1, dados, atualizado_em: new Date().toISOString() });
    return new Response(JSON.stringify(dados), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ erro: String((e as Error).message ?? e) }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
