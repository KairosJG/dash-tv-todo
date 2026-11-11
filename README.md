# Dash TV · TO-DO do dia (12P Delivery)

Página única em ES5 (compatível com o navegador da Samsung/Tizen).

- **TV:** `https://kairosjg.github.io/dash-tv-todo/?tv`, só exibe e atualiza sozinha (ticks a cada 15 s, monday a cada 3 min).
- **PC:** `https://kairosjg.github.io/dash-tv-todo/`, clique nas tarefas para marcar como feitas e use **Editar daily** para colar a daily do dia.

## Formato da daily
```
DATA: 11/11
@ Nome            -> pessoa
@ Nome | Folga    -> pessoa de folga
# Grupo           -> subtítulo
4 novas audits    -> número no começo vira destaque
! texto           -> alerta (vermelho)
```

## Backend (Supabase: portal-delivery)
- `supabase/migrations/001_tv_todo.sql`: tabelas `tv_daily`, `tv_ticks`, `tv_monday_cache`
- `supabase/functions/tv-monday`: conta os projetos do quadro "Delivery 🟡 Produção" (grupo Tarefas Pendentes) sem comentário humano hoje, por Delivery FUP (Pietra, Rhany, Carol, Jana). Precisa do secret `MONDAY_TOKEN`.
