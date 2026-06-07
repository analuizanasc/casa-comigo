# Análise de Requisitos — Casa Comigo

## Informações do Documento
- **Fonte:** REQUISITOS.md
- **Produto:** Casa Comigo — Plataforma Web de Gestão Doméstica Colaborativa
- **Data:** 2026-06-07
- **Status:** Em análise
- **Escopo:** Análise completa de todos os épicos (EP01–EP07)

---

## Descrição da Funcionalidade

O **Casa Comigo** é uma plataforma de gestão doméstica colaborativa que distribui tarefas entre moradores de forma inteligente e justa. O sistema contempla cadastro de casas e membros, catálogo de tarefas, registro de preferências e limitações, distribuição automática por peso percentual, cronograma visual, notificações por e-mail e in-app, e histórico de execução — tudo gerenciado através de três níveis de acesso: Administrador, Gestor de Catálogo e Morador.

---

## Product Outline (Artefatos Testáveis)

### Endpoints

| Módulo | Método | Rota | Descrição |
|--------|--------|------|-----------|
| Casas | POST | /api/houses | Criar uma nova casa |
| Casas | GET | /api/houses/:id | Obter dados da casa |
| Casas | PATCH | /api/houses/:id/tolerance | Atualizar tolerância de desvio |
| Membros | POST | /api/houses/:id/members | Convidar morador |
| Membros | GET | /api/houses/:id/members | Listar moradores |
| Membros | PATCH | /api/houses/:id/members/:memberId | Editar perfil/peso/permissão |
| Membros | DELETE | /api/houses/:id/members/:memberId | Remover morador |
| Catálogo | GET | /api/houses/:id/tasks | Listar tarefas do catálogo |
| Catálogo | POST | /api/houses/:id/tasks | Criar tarefa personalizada |
| Catálogo | PUT | /api/houses/:id/tasks/:taskId | Editar tarefa |
| Catálogo | DELETE | /api/houses/:id/tasks/:taskId | Remover tarefa |
| Preferências | POST | /api/houses/:id/preferences | Registrar preferência por tarefa |
| Preferências | GET | /api/houses/:id/preferences | Listar preferências do morador |
| Distribuição | POST | /api/houses/:id/distribution | Gerar distribuição para período |
| Distribuição | GET | /api/houses/:id/distribution | Visualizar distribuição gerada |
| Distribuição | PATCH | /api/houses/:id/distribution/:assignId | Troca manual de responsável |
| Cronograma | GET | /api/houses/:id/schedule/weekly | Calendário semanal do morador |
| Cronograma | GET | /api/houses/:id/schedule/monthly | Visão mensal (admin) |
| Cronograma | GET | /api/houses/:id/schedule/annual | Visão anual com indicadores |
| Atribuições | PATCH | /api/assignments/:id/complete | Marcar tarefa como concluída |
| Atribuições | POST | /api/assignments/:id/impediment | Reportar impedimento |
| Notificações | GET | /api/houses/:id/alerts | Alertas in-app do dia |
| Relatórios | GET | /api/houses/:id/reports/performance | Relatório de desempenho por morador |

---

### Fluxos

**Principal — Ciclo completo de gestão:**
1. Admin cria casa → convida moradores → configura pesos de distribuição
2. Admin/Gestor configura catálogo de tarefas com atributos e dependências
3. Moradores registram preferências e limitações físicas
4. Admin aciona distribuição automática para o período desejado
5. Admin revisa e ajusta a grade antes de confirmar
6. Moradores visualizam cronograma e marcam tarefas concluídas
7. Sistema envia notificações e mantém histórico

**Alternativos:**
- Morador reporta impedimento → redistribuição automática para outro membro disponível
- Admin altera pesos → sistema exibe alerta de redistribuição de períodos futuros
- Morador arrasta tarefa no calendário para reagendar dentro da semana
- Admin concede/revoga permissão de Gestor de Catálogo sem remover membro da casa

**Exceções e Erros:**
- Pesos não somam 100% → rejeitar salvo/exibir erro de validação
- Tarefa atribuída a morador com limitação física → bloqueio no algoritmo de distribuição
- Redistribuição excede limite de carga do receptor → buscar próximo candidato elegível
- Tarefa semanal sem responsável há 2 dias → alerta crítico para o admin

---

### Pontos de Decisão

| Condição | Sim | Não |
|----------|-----|-----|
| Pesos de distribuição foram definidos? | Distribuir conforme pesos percentuais | Distribuir igualitariamente |
| Morador tem limitação física para a tarefa? | Bloquear atribuição (`-Infinity` no score) | Permitir atribuição com score normal |
| Redistribuição aumentaria carga além do limite? | Buscar próximo candidato | Atribuir ao morador |
| Tarefas têm dependência de ordem? | Agrupar e ordenar topologicamente | Distribuir independentemente |
| Admin alterou pesos com distribuição ativa? | Exibir alerta de redistribuição | Salvar silenciosamente |
| Tarefa não concluída ao fim do dia? | Enviar e-mail de notificação | Nenhuma ação |
| Tarefa semanal sem responsável há 2 dias? | Emitir alerta crítico | Nenhuma ação |
| Morador possui conta própria? | Exibir apenas suas tarefas | Negar acesso |

---

### Integrações com a Esteira

- **Recebe de:** Cadastro de usuários (autenticação JWT) — token de sessão, identidade do morador
- **Envia para:** Sistema de e-mail transacional — resumos diários, alertas de não-conclusão, resumo semanal admin
- **Futuro:** App mobile — push notifications (fora do escopo da v1 web)

---

### Componentes de Tela (UI/E2E)

| Tela / Componente | Estado / Comportamento Testável |
|-------------------|---------------------------------|
| Dashboard do Morador | Banner de alertas in-app visível com tarefas do dia ao abrir |
| Calendário Semanal | Tarefas do dia destacadas; cores distintas para atrasada/concluída/pendente |
| Calendário Semanal | Drag and drop funcional para reagendar dentro da semana |
| Visão Mensal (admin) | Todas as tarefas de todos os moradores visíveis |
| Visão Anual (admin) | Indicadores de cobertura: semanas com alta/baixa carga |
| Painel de Balanceamento | Exibe % real vs. % definido por morador antes de confirmar distribuição |
| Grade de Distribuição | Admin pode trocar responsável manualmente antes de confirmar |
| Formulário de Tarefa | Campos: frequência, duração, esforço, cômodo, dependências |
| Preferências | Escala odeio/neutro/gosto por tarefa; toggle de limitação física |
| Configuração de Notificações | Campo de horário do e-mail diário configurável por morador |

---

### Dados e Tabelas Oracle

| Tabela | Papel no contexto |
|--------|-------------------|
| `users` | Identidade e autenticação dos moradores |
| `houses` | Casa como unidade de gestão; isolamento de dados entre casas |
| `house_members` | Vínculo usuário × casa com papel (admin/catalog_manager/resident) e peso |
| `task_catalog` | Catálogo de tarefas com atributos (frequência, esforço, cômodo) |
| `task_dependencies` | Dependências de ordem entre tarefas (auto-referência) |
| `member_preferences` | Preferências e limitações físicas por morador × tarefa × casa |
| `task_assignments` | Atribuições concretas: tarefa × responsável × data × status |

---

## Tabela 01 — Requisitos Funcionais

| ID | Requisito Funcional | Épico | Testabilidade |
|----|---------------------|-------|---------------|
| RF-01 | Permitir que o administrador crie uma casa e convide moradores por e-mail | EP01-US01 | Sim |
| RF-02 | Permitir que o administrador cadastre e edite perfis de moradores (nome, foto, disponibilidade semanal) | EP01-US02 | Sim |
| RF-03 | Permitir que o morador acesse o sistema com sua conta e visualize apenas suas próprias tarefas e informações | EP01-US03 | Sim |
| RF-04 | Permitir que o administrador conceda a permissão de Gestor de Catálogo a um morador da casa | EP01-US04 | Sim |
| RF-05 | Permitir que o administrador revogue a permissão de Gestor de Catálogo sem remover o membro da casa | EP01-US05 | Sim |
| RF-06 | Disponibilizar catálogo pré-definido de tarefas domésticas comuns acessível a administradores e gestores de catálogo | EP02-US01 | Sim |
| RF-07 | Permitir que administrador ou gestor de catálogo crie, edite e remova tarefas personalizadas | EP02-US02 | Sim |
| RF-08 | Permitir configurar para cada tarefa: frequência, duração estimada, nível de esforço, cômodo e dependências de ordem com outras tarefas | EP02-US03 | Sim |
| RF-09 | Agrupar automaticamente tarefas do mesmo cômodo e com dependências de ordem para execução sequencial e eficiente | EP02-US04 | Sim |
| RF-10 | Permitir que o morador classifique sua preferência por cada tarefa em escala de três níveis (odeio / neutro / gosto) | EP03-US01 | Sim |
| RF-11 | Permitir que o morador marque tarefas para as quais possui limitação física, impedindo atribuição futura | EP03-US02 | Sim |
| RF-12 | Considerar preferências e limitações físicas dos moradores no algoritmo de distribuição de tarefas | EP03-US03 | Sim |
| RF-13 | Permitir que o administrador defina peso de distribuição percentual para cada morador | EP03-US04 | Sim |
| RF-14 | Exibir painel de balanceamento com percentual de esforço atual versus percentual definido por morador antes de confirmar a distribuição | EP03-US05 | Sim |
| RF-15 | Gerar distribuição automática de tarefas para o período selecionado pelo administrador (semana, mês, trimestre ou ano inteiro) | EP04-US01 | Sim |
| RF-16 | Calcular a distribuição considerando: frequência de cada tarefa, preferências, pesos percentuais, equilíbrio de esforço, disponibilidade semanal e agrupamentos por cômodo e dependência | EP04-US02 | Sim |
| RF-17 | Exibir a distribuição gerada para revisão pelo administrador antes de confirmação | EP04-US03 | Sim |
| RF-18 | Permitir que o administrador troque manualmente a tarefa de um morador para outro na grade de distribuição | EP04-US04 | Sim |
| RF-19 | Redistribuir automaticamente uma tarefa para outro morador elegível quando o responsável reportar impedimento | EP04-US05 | Sim |
| RF-20 | Exibir calendário semanal com as tarefas do morador, com destaque nas tarefas do dia corrente | EP05-US01 | Sim |
| RF-21 | Exibir visão mensal completa com todas as tarefas de todos os moradores para o administrador | EP05-US02 | Sim |
| RF-22 | Exibir visão anual com indicadores de cobertura (semanas com alta ou baixa carga) para o administrador | EP05-US03 | Sim |
| RF-23 | Permitir que o morador reagende tarefas via drag and drop no calendário, dentro do período semanal | EP05-US04 | Sim |
| RF-24 | Sinalizar visualmente tarefas atrasadas, concluídas e pendentes com cores distintas no calendário | EP05-US05 | Sim |
| RF-25 | Enviar e-mail de resumo diário de tarefas para o morador no início do dia | EP06-US01 | Sim |
| RF-26 | Permitir que o morador configure o horário de envio do e-mail de lembrete diário | EP06-US02 | Sim |
| RF-27 | Enviar e-mail de notificação de tarefa não concluída ao final do dia | EP06-US03 | Sim |
| RF-28 | Enviar resumo semanal por e-mail para o administrador com status da casa (% concluído, tarefas em atraso) | EP06-US04 | Sim |
| RF-29 | Exibir banner de alertas in-app ao abrir o sistema com as tarefas do dia e pendências | EP06-US05 | Sim |
| RF-30 | Permitir que o morador marque uma tarefa como concluída com um único toque/clique | EP07-US01 | Sim |
| RF-31 | Permitir que o morador adicione observação textual ao concluir uma tarefa (ex.: produto acabou, precisa de manutenção) | EP07-US02 | Sim |
| RF-32 | Gerar relatórios de desempenho por morador contendo tarefas concluídas, atrasadas e evitadas | EP07-US03 | Sim |
| RF-33 | Manter histórico completo de execução de tarefas por até dois anos para análise de padrões | EP07-US04 | Sim |

---

## Tabela 02 — Regras de Negócio

| ID | Regra de Negócio | Origem | Testabilidade |
|----|------------------|--------|---------------|
| RN-01 | Garantir que tarefas com dependência de ordem sejam sempre agendadas em sequência na mesma sessão de execução, nunca em dias ou momentos diferentes | RN01 / EP02-US04 | Sim |
| RN-02 | Garantir que os pesos de distribuição percentual definidos pelo administrador somem exatamente 100% | RN02 | Sim |
| RN-03 | Garantir que o desvio de esforço real de cada morador em relação ao seu peso definido não exceda ±10 pontos percentuais (valor configurável) | RN02 | Sim |
| RN-04 | Garantir que, na ausência de pesos definidos, a distribuição de tarefas seja igualitária automaticamente entre todos os moradores da casa | RN02 | Sim |
| RN-05 | Garantir que tarefas com limitação física registrada por um morador nunca sejam atribuídas a esse morador | RN03 | Sim |
| RN-06 | Garantir que a redistribuição automática não aumente a carga de nenhum morador que já se encontra no limite de esforço definido pelo seu peso percentual | RN04 | Sim |
| RN-07 | Garantir que tarefas com frequência semanal ou maior não fiquem sem responsável por mais de 2 dias corridos | RN05 | Sim |
| RN-08 | Garantir que existam exatamente três níveis de acesso no sistema — Administrador, Gestor de Catálogo e Morador — com escopo de permissões distintos e não sobrepostos | RN06 | Sim |
| RN-09 | Garantir que ao alterar pesos de distribuição de um morador, o sistema exiba alerta perguntando se os períodos futuros já planejados devem ser redistribuídos ou mantidos | RN07 | Sim |
| RN-10 | Validar que as preferências de tarefas sejam classificadas em exatamente três categorias: odeio, neutro e gosto | EP03-US01 | Sim |
| RN-11 | Garantir que o histórico de execução de tarefas seja mantido por até dois anos para análise de padrões | EP07-US04 | Sim |
| RN-12 | Validar que a frequência de uma tarefa seja configurável apenas entre os valores: diária, semanal, quinzenal, mensal, trimestral ou anual | EP02-US03 | Sim |
| RN-13 | Garantir que dados de uma casa (tarefas, membros, histórico) nunca sejam visíveis para moradores de outra casa | RNF05 | Sim |
| RN-14 | Garantir que o nível Administrador seja atribuído exclusivamente ao criador da casa, sendo o único que pode conceder e revogar a permissão de Gestor de Catálogo | RN06 / EP01-US04 | Sim |

---

## Observações e Pontos de Atenção

### Lacunas Identificadas

1. **Conflito de reagendamento por drag and drop (EP05-US04 × RN01):** O requisito permite que o morador arraste tarefas para reagendar dentro da semana, mas a RN01 exige que tarefas dependentes permaneçam na mesma sessão. Não está especificado o comportamento do sistema quando o morador tenta mover apenas uma tarefa de um grupo com dependência. **Necessita refinamento.**

2. **Limite de distribuição igualitária sem precisão (RN02):** A regra menciona "desvio tolerado ±10pp configurável", mas não especifica onde essa configuração é realizada, por quem, e se há valor mínimo/máximo para o parâmetro. **Necessita refinamento.**

3. **Redistribuição automática por impedimento sem SLA (EP04-US05 × RN05):** O RF-19 define redistribuição automática, mas não especifica o tempo máximo para que a redistribuição seja realizada após o reporte de impedimento. Combinado com a RN-07 (2 dias corridos), esse prazo precisa ser explicitado. **Necessita refinamento.**

4. **Ausência de critério de desempate na distribuição (EP04-US02):** O algoritmo considera múltiplos fatores (preferência, carga, disponibilidade), mas não está especificado o critério de desempate quando dois moradores têm score idêntico. **Necessita refinamento.**

5. **Foto de perfil — armazenamento não especificado (EP01-US02):** O RF-02 prevê foto no perfil do morador, mas não há definição sobre formato aceito, tamanho máximo, ou onde é armazenada. **Necessita refinamento.**

6. **Notificações in-app — persistência não definida (EP06-US05):** O RF-29 especifica banner de alertas in-app, mas não há regra sobre por quanto tempo o alerta permanece visível, se pode ser descartado pelo morador, ou se é relido ao reabrir o sistema. **Necessita refinamento.**

7. **Visão anual — definição de "alta/baixa carga" não quantificada (EP05-US03):** O RF-22 menciona indicadores de cobertura para semanas com alta ou baixa carga, mas não define os thresholds que caracterizam cada nível. **Necessita refinamento.**

8. **Histórico de execução — política de retenção após 2 anos (EP07-US04 / RN-11):** Não está especificado se os registros são excluídos automaticamente, arquivados ou simplesmente ignorados nas consultas após o prazo de 2 anos. **Necessita refinamento.**

### Riscos Identificados

- **Complexidade do algoritmo de distribuição (RF-16):** Considera seis variáveis simultâneas. Testes de performance (RNF03 — carregamento em menos de 2s) podem ser impactados dependendo do tamanho do catálogo e período.
- **Funcionamento offline (RNF06):** A marcação de conclusão e a visualização do cronograma offline dependem de estratégia de service worker/cache não detalhada nos requisitos funcionais — esse escopo precisa ser detalhado antes da implementação.
- **Push notification como escopo futuro (EP06):** Requisito marcado para fase mobile; garantir que a arquitetura de notificações da v1 seja extensível para push sem reescrita.
