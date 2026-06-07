# Casa Comigo — Condições de Teste

## Informações
- **Título:** Gestão Doméstica Colaborativa — Épicos EP01–EP07
- **Fonte:** ANALISE-RN-RF.md
- **Data:** 2026-06-07
- **Status:** Em análise

> **Lacunas a alinhar antes de criar os casos de teste**
> - Validações de foto de perfil (formato, tamanho, armazenamento) não especificadas → ver CT-03
> - Comportamento ao convidar e-mail já membro da casa não especificado → ver CT-02
> - Acesso de resident ao catálogo (leitura vs. sem acesso) não definido → ver CT-07
> - Comportamento ao criar dependência circular entre tarefas não especificado → ver CT-10
> - Comportamento ao remover tarefa com atribuições ativas não especificado → ver CT-12
> - Comportamento quando nenhum morador é elegível para uma tarefa não especificado → ver CT-15
> - Onde/como a tolerância de desvio é configurada e limites mínimo/máximo não especificados → ver CT-18
> - Alerta de redistribuição exibido apenas quando há períodos planejados ou sempre → ver CT-20
> - Comportamento quando todos os moradores estão no limite de carga na redistribuição → ver CT-23
> - "Frequência semanal ou maior" (RN-07): se inclui tarefas diárias ou apenas semanal → ver CT-24
> - Bloqueio ou aviso ao trocar manualmente responsável com limitação física → ver CT-25
> - Horário padrão de envio do e-mail diário quando morador não configurou → ver CT-31
> - Comportamento do banner in-app quando morador não tem tarefas no dia → ver CT-34
> - Persistência/descartabilidade do banner de alertas in-app → ver CT-34
> - Limite de caracteres da observação ao concluir tarefa → ver CT-36
> - Acesso do morador ao próprio relatório de desempenho → ver CT-37
> - Comportamento de registros com exatamente 2 anos / mais de 2 anos no histórico → ver CT-38
> - Thresholds de "alta/baixa carga" na visão anual não quantificados → ver CT-29
> - Comportamento ao tentar arrastar tarefa para fora da semana corrente → ver CT-30
> - O que acontece ao mover apenas uma tarefa de um grupo com dependência (drag and drop) → ver CT-30
> - Se é possível morador concluir tarefa de outro morador → ver CT-35
> - Comportamento ao marcar como concluída uma tarefa já concluída → ver CT-35
> - Se admin pode conceder papel de admin a outro membro → ver CT-05

---

## G1 — Gestão de Casas e Membros
> Valida criação de casa, convite de moradores, controle de acesso por papel e isolamento de dados entre casas.

### CT-01 — Criação de casa por usuário autenticado

**Técnica(s):** PE
**Rastreabilidade:** RF-01, RN-14

| Variante | Entrada/Condição Específica | Resultado Esperado |
|---|---|---|
| V1 — Usuário autenticado cria casa com dados válidos | Requisição POST /api/houses com token JWT válido e payload completo | Casa criada; criador torna-se admin automaticamente; retorna 201 |
| V2 — Usuário não autenticado tenta criar casa | Requisição POST /api/houses sem token JWT | Acesso negado; retorna 401 |

---

### CT-02 — Convite de morador por e-mail

**Técnica(s):** PE
**Rastreabilidade:** RF-01

| Variante | Entrada/Condição Específica | Resultado Esperado |
|---|---|---|
| V1 — Admin convida e-mail válido não cadastrado na casa | POST /api/houses/:id/members com e-mail válido e token de admin | Convite enviado; morador adicionado com papel resident |
| V2 — Admin convida e-mail já membro da casa | POST com e-mail de morador já existente na casa | [falta informacao: comportamento não especificado — duplicata permitida, ignorada ou erro?] |
| V3 — Admin convida e-mail com formato inválido | POST com e-mail malformado (sem @, sem domínio) | Rejeitado; retorna erro de validação |
| V4 — Não-admin (resident) tenta convidar morador | POST /api/houses/:id/members com token de resident | Acesso negado; retorna 403 |

---

### CT-03 — Cadastro e edição de perfil de morador

**Técnica(s):** PE
**Rastreabilidade:** RF-02

| Variante | Entrada/Condição Específica | Resultado Esperado |
|---|---|---|
| V1 — Admin edita nome do morador com dados válidos | PATCH /api/houses/:id/members/:memberId com nome válido | Perfil atualizado; retorna 200 |
| V2 — Admin edita disponibilidade semanal com valor válido | PATCH com campo de disponibilidade preenchido | Disponibilidade atualizada |
| V3 — Admin edita foto do morador | PATCH com arquivo de foto | [falta informacao: formato aceito, tamanho máximo e local de armazenamento não definidos] |
| V4 — Resident tenta editar perfil de outro morador | PATCH com token de resident e memberId de outro morador | Acesso negado; retorna 403 |

---

### CT-04 — Isolamento de dados entre casas

**Técnica(s):** PE
**Rastreabilidade:** RN-13

| Variante | Entrada/Condição Específica | Resultado Esperado |
|---|---|---|
| V1 — Morador da casa A tenta acessar dados da casa B | GET /api/houses/:idB/* com token de membro da casa A | Acesso negado; retorna 403 ou 404 |
| V2 — Morador acessa dados da própria casa | GET /api/houses/:id/* com token de membro da casa | Dados retornados corretamente |

---

### CT-05 — Concessão e revogação de permissão de Gestor de Catálogo

**Técnica(s):** TD
**Rastreabilidade:** RF-04, RF-05, RN-08, RN-14

| Variante | Entrada/Condição Específica | Resultado Esperado |
|---|---|---|
| V1 — Admin concede permissão de Gestor a resident | PATCH /api/houses/:id/members/:memberId com role=catalog_manager, token de admin | Papel atualizado para catalog_manager; membro permanece na casa |
| V2 — Admin revoga permissão de Gestor | PATCH com role=resident, token de admin | Papel retorna a resident; membro permanece na casa |
| V3 — Resident tenta conceder permissão a outro morador | PATCH com token de resident | Acesso negado; retorna 403 |
| V4 — Gestor de Catálogo tenta conceder permissão a outro morador | PATCH com token de catalog_manager | Acesso negado; retorna 403 |
| V5 — Admin tenta conceder papel de admin a outro membro | PATCH com role=admin, token de admin | [falta informacao: se a concessão do papel admin é possível ou restrita ao criador da casa] |

---

### CT-06 — Controle de acesso por papel — escopo de visibilidade

**Técnica(s):** TD
**Rastreabilidade:** RF-03, RF-04, RF-05, RN-08

| Variante | Entrada/Condição Específica | Resultado Esperado |
|---|---|---|
| V1 — Resident acessa cronograma semanal | GET /api/houses/:id/schedule/weekly com token de resident | Retorna apenas as tarefas atribuídas ao próprio morador |
| V2 — Resident tenta acessar visão mensal (exclusiva de admin) | GET /api/houses/:id/schedule/monthly com token de resident | Acesso negado; retorna 403 |
| V3 — Admin acessa tarefas de qualquer morador da casa | GET /api/houses/:id/schedule/monthly com token de admin | Todas as tarefas de todos os moradores retornadas |
| V4 — Gestor de Catálogo acessa e gerencia catálogo | GET/POST /api/houses/:id/tasks com token de catalog_manager | Acesso permitido; pode ler e criar tarefas |

---

## G2 — Catálogo de Tarefas
> Valida acesso ao catálogo, criação/edição/remoção de tarefas, configuração de atributos, frequências válidas e dependências de ordem.

### CT-07 — Acesso ao catálogo pré-definido por papel

**Técnica(s):** PE
**Rastreabilidade:** RF-06, RN-08

| Variante | Entrada/Condição Específica | Resultado Esperado |
|---|---|---|
| V1 — Admin acessa catálogo de tarefas | GET /api/houses/:id/tasks com token de admin | Lista de tarefas do catálogo retornada |
| V2 — Gestor de Catálogo acessa catálogo | GET /api/houses/:id/tasks com token de catalog_manager | Lista retornada |
| V3 — Resident tenta acessar catálogo | GET /api/houses/:id/tasks com token de resident | [falta informacao: se resident tem acesso de leitura ao catálogo ou é bloqueado] |

---

### CT-08 — Criação de tarefa personalizada por papel

**Técnica(s):** PE
**Rastreabilidade:** RF-07, RN-08

| Variante | Entrada/Condição Específica | Resultado Esperado |
|---|---|---|
| V1 — Admin cria tarefa com todos os campos válidos | POST /api/houses/:id/tasks com payload completo e token de admin | Tarefa criada no catálogo; retorna 201 |
| V2 — Gestor de Catálogo cria tarefa com campos válidos | POST com token de catalog_manager | Tarefa criada; retorna 201 |
| V3 — Resident tenta criar tarefa | POST com token de resident | Acesso negado; retorna 403 |
| V4 — Admin cria tarefa sem campos obrigatórios | POST com payload incompleto (ex.: sem nome) | Rejeitado; retorna erro de validação |

---

### CT-09 — Configuração de frequência de tarefa

**Técnica(s):** PE
**Rastreabilidade:** RF-08, RN-12

| Variante | Entrada/Condição Específica | Resultado Esperado |
|---|---|---|
| V1 — Frequência = "diária" | POST/PUT com frequency="diária" | Aceito; tarefa criada/atualizada |
| V2 — Frequência = "semanal" | POST/PUT com frequency="semanal" | Aceito |
| V3 — Frequência = "quinzenal" | POST/PUT com frequency="quinzenal" | Aceito |
| V4 — Frequência = "mensal" | POST/PUT com frequency="mensal" | Aceito |
| V5 — Frequência = "trimestral" | POST/PUT com frequency="trimestral" | Aceito |
| V6 — Frequência = "anual" | POST/PUT com frequency="anual" | Aceito |
| V7 — Frequência com valor fora dos seis aceitos | POST/PUT com frequency="bimestral" ou outro valor arbitrário | Rejeitado; retorna erro de validação |

---

### CT-10 — Definição e validação de dependências de ordem entre tarefas

**Técnica(s):** PE
**Rastreabilidade:** RF-08, RF-09, RN-01

| Variante | Entrada/Condição Específica | Resultado Esperado |
|---|---|---|
| V1 — Tarefa B definida como dependente de tarefa A | POST/PUT com task_dependency apontando A→B | Dependência registrada; na distribuição, A precede B na mesma sessão |
| V2 — Dependência circular criada (A depende de B e B de A) | POST/PUT que cria ciclo entre tarefas | [falta informacao: se o sistema valida e rejeita ciclos ou permite e falha silenciosamente] |
| V3 — Tarefas do mesmo cômodo sem dependência entre si | Configuração sem campo de dependências | Distribuídas como tarefas independentes; agrupadas por cômodo mas sem ordenação obrigatória entre elas |

---

### CT-11 — Agrupamento de tarefas por cômodo e dependência na distribuição

**Técnica(s):** PE
**Rastreabilidade:** RF-09, RN-01

| Variante | Entrada/Condição Específica | Resultado Esperado |
|---|---|---|
| V1 — Tarefas do mesmo cômodo com dependências | Distribuição gerada para período com grupo de tarefas dependentes no mesmo cômodo | Tarefas agrupadas e ordenadas topologicamente; atribuídas ao mesmo membro na mesma sessão |
| V2 — Tarefas do mesmo cômodo sem dependências | Distribuição gerada para período com tarefas no mesmo cômodo sem vínculo | Agrupadas por cômodo; ordenação dentro do grupo é livre |
| V3 — Tentativa de atribuição de tarefas dependentes a moradores diferentes | Algoritmo tenta separar tarefas do grupo | [falta informacao: se o sistema bloqueia a separação ou apenas exibe aviso] |

---

### CT-12 — Edição e remoção de tarefa personalizada

**Técnica(s):** PE
**Rastreabilidade:** RF-07

| Variante | Entrada/Condição Específica | Resultado Esperado |
|---|---|---|
| V1 — Admin edita tarefa existente com dados válidos | PUT /api/houses/:id/tasks/:taskId com payload válido | Tarefa atualizada; retorna 200 |
| V2 — Admin remove tarefa existente sem atribuições ativas | DELETE /api/houses/:id/tasks/:taskId | Tarefa removida do catálogo; retorna 200 ou 204 |
| V3 — Gestor de Catálogo remove tarefa | DELETE com token de catalog_manager | Tarefa removida |
| V4 — Resident tenta editar tarefa | PUT com token de resident | Acesso negado; retorna 403 |
| V5 — Admin remove tarefa com atribuições ativas | DELETE de tarefa com assignments futuros pendentes | [falta informacao: comportamento não especificado — rejeitar, cancelar atribuições ou permitir] |

---

## G3 — Preferências e Limitações Físicas
> Valida registro de preferências em três níveis, marcação de limitações físicas e seus efeitos no algoritmo de distribuição.

### CT-13 — Classificação de preferência por tarefa em três níveis

**Técnica(s):** PE
**Rastreabilidade:** RF-10, RN-10

| Variante | Entrada/Condição Específica | Resultado Esperado |
|---|---|---|
| V1 — Morador classifica tarefa como "odeio" | POST /api/houses/:id/preferences com preference="odeio" | Preferência registrada |
| V2 — Morador classifica tarefa como "neutro" | POST com preference="neutro" | Preferência registrada |
| V3 — Morador classifica tarefa como "gosto" | POST com preference="gosto" | Preferência registrada |
| V4 — Morador classifica com valor fora dos três níveis | POST com preference="muito gosto" ou valor arbitrário | Rejeitado; retorna erro de validação |
| V5 — Morador altera preferência já registrada | POST com preference diferente para mesma tarefa | Preferência anterior sobrescrita; nova salva |

---

### CT-14 — Registro e remoção de limitação física

**Técnica(s):** PE
**Rastreabilidade:** RF-11, RN-05

| Variante | Entrada/Condição Específica | Resultado Esperado |
|---|---|---|
| V1 — Morador marca limitação física para uma tarefa | POST /api/houses/:id/preferences com physical_limitation=true | Limitação registrada; tarefa bloqueada para atribuição futura ao morador |
| V2 — Morador remove limitação física de tarefa | POST/PATCH com physical_limitation=false | Limitação removida; tarefa elegível para atribuição ao morador |

---

### CT-15 — Influência de preferências e limitações no algoritmo de distribuição

**Técnica(s):** TD
**Rastreabilidade:** RF-12, RN-05

| Variante | Entrada/Condição Específica | Resultado Esperado |
|---|---|---|
| V1 — Morador com preferência "gosto" e sem limitação | Distribuição para tarefa onde morador tem preferência positiva | Score do morador elevado; morador tem maior probabilidade de receber a tarefa |
| V2 — Morador com preferência "odeio" e sem limitação | Distribuição para tarefa onde morador tem preferência negativa | Score reduzido; morador tem menor probabilidade de receber a tarefa (mas não é bloqueado) |
| V3 — Morador com limitação física para a tarefa | Distribuição para tarefa em que morador marcou limitação | Score = -Infinity; morador nunca atribuído independentemente de outros fatores |
| V4 — Todos os moradores elegíveis com limitação para a mesma tarefa | Distribuição com nenhum candidato com score ≥ -Infinity | [falta informacao: comportamento do sistema quando não há nenhum morador elegível para a tarefa] |

---

## G4 — Pesos de Distribuição
> Valida soma dos pesos percentuais, distribuição igualitária na ausência de pesos, tolerância de desvio e alertas ao alterar pesos com períodos planejados.

### CT-16 — Validação da soma dos pesos percentuais

**Técnica(s):** AVL
**Rastreabilidade:** RF-13, RN-02

| Variante | Entrada/Condição Específica | Resultado Esperado |
|---|---|---|
| V1 — Pesos somam exatamente 100% | PATCH /api/houses/:id/members/:memberId com peso que totaliza 100% ao somar com demais membros | Aceito; pesos salvos |
| V2 — Pesos somam menos de 100% | Configuração onde soma total dos membros < 100% | Rejeitado; retorna erro de validação |
| V3 — Pesos somam mais de 100% | Configuração onde soma total dos membros > 100% | Rejeitado; retorna erro de validação |
| V4 — Casa com único morador, peso = 100% | PATCH com peso = 100 para único membro | Aceito |

---

### CT-17 — Distribuição igualitária na ausência de pesos definidos

**Técnica(s):** PE
**Rastreabilidade:** RN-04

| Variante | Entrada/Condição Específica | Resultado Esperado |
|---|---|---|
| V1 — Casa com 2 moradores sem pesos definidos | Distribuição acionada sem configuração de pesos | Cada morador recebe aproximadamente 50% do esforço total |
| V2 — Casa com 3 moradores sem pesos definidos | Distribuição acionada sem configuração de pesos | Cada morador recebe aproximadamente 33% do esforço |
| V3 — Casa com 1 morador sem peso definido | Distribuição acionada | Morador único recebe 100% das tarefas |

---

### CT-18 — Tolerância de desvio de esforço

**Técnica(s):** AVL
**Rastreabilidade:** RF-14, RN-03

| Variante | Entrada/Condição Específica | Resultado Esperado |
|---|---|---|
| V1 — Desvio de esforço do morador exatamente igual ao limite configurado (+10pp) | Morador com esforço real = peso definido + 10pp | Aceito; dentro da tolerância |
| V2 — Desvio de esforço do morador exatamente igual ao limite negativo (-10pp) | Morador com esforço real = peso definido - 10pp | Aceito; dentro da tolerância |
| V3 — Desvio de esforço abaixo do limite (ex: +5pp) | Morador com esforço real = peso definido + 5pp | Aceito; dentro da tolerância |
| V4 — Desvio de esforço acima do limite (ex: +11pp) | Morador com esforço real = peso definido + 11pp | Sinalizado como fora da tolerância no painel de balanceamento |
| V5 — Admin configura tolerância personalizada diferente de 10pp | PATCH /api/houses/:id/tolerance com valor válido | [falta informacao: valores mínimo/máximo permitidos para o parâmetro de tolerância não especificados] |

---

### CT-19 — Painel de balanceamento antes de confirmar distribuição

**Técnica(s):** PE
**Rastreabilidade:** RF-14

| Variante | Entrada/Condição Específica | Resultado Esperado |
|---|---|---|
| V1 — Admin acessa revisão da distribuição gerada | GET /api/houses/:id/distribution após geração | Painel exibe % esforço atual vs. % definido por morador para cada membro |
| V2 — Morador com desvio fora da tolerância na distribuição | Distribuição gerada com desequilíbrio acima do limite | Sinalização visual de desequilíbrio exibida para o morador em questão |

---

### CT-20 — Alerta de redistribuição ao alterar pesos com períodos planejados

**Técnica(s):** PE
**Rastreabilidade:** RN-09

| Variante | Entrada/Condição Específica | Resultado Esperado |
|---|---|---|
| V1 — Admin altera peso com período futuro já distribuído | PATCH de peso com distribuições futuras ativas | Sistema exibe alerta perguntando se períodos futuros devem ser redistribuídos ou mantidos |
| V2 — Admin altera peso sem períodos futuros planejados | PATCH de peso quando não há distribuição futura | [falta informacao: se o alerta é exibido apenas quando há períodos planejados ou sempre] |
| V3 — Admin confirma redistribuição dos períodos futuros | Seleção "redistribuir" no alerta | Redistribuição executada para os períodos futuros; atribuições anteriores substituídas |
| V4 — Admin cancela redistribuição no alerta | Seleção "manter" no alerta | Pesos salvos; atribuições dos períodos futuros mantidas inalteradas |

---

## G5 — Distribuição Automática
> Valida geração de distribuição por período, respeito a dependências, redistribuição por impedimento, troca manual e alertas de tarefa sem responsável.

### CT-21 — Geração de distribuição por período

**Técnica(s):** PE
**Rastreabilidade:** RF-15, RF-16

| Variante | Entrada/Condição Específica | Resultado Esperado |
|---|---|---|
| V1 — Admin aciona distribuição para período = semana | POST /api/houses/:id/distribution com período semanal | Tarefas distribuídas e atribuições geradas para a semana |
| V2 — Admin aciona distribuição para período = mês | POST com período mensal | Tarefas distribuídas para o mês |
| V3 — Admin aciona distribuição para período = trimestre | POST com período trimestral | Tarefas distribuídas para o trimestre |
| V4 — Admin aciona distribuição para período = ano | POST com período anual | Tarefas distribuídas para o ano inteiro |
| V5 — Resident tenta acionar distribuição | POST com token de resident | Acesso negado; retorna 403 |

---

### CT-22 — Respeito às dependências de ordem na distribuição gerada

**Técnica(s):** PE
**Rastreabilidade:** RN-01, RF-09

| Variante | Entrada/Condição Específica | Resultado Esperado |
|---|---|---|
| V1 — Tarefas com dependência de ordem incluídas no período | Distribuição gerada com tarefas A→B dependentes | Tarefa A e tarefa B atribuídas ao mesmo membro; A aparece antes de B na mesma sessão de execução; nunca em datas diferentes |
| V2 — Tarefas dependentes sem responsável atribuído separadamente | Qualquer situação pós-distribuição | Sistema garante que tarefas do grupo nunca fiquem atribuídas a datas ou membros diferentes |

---

### CT-23 — Redistribuição automática por impedimento reportado

**Técnica(s):** TD
**Rastreabilidade:** RF-19, RN-06

| Variante | Entrada/Condição Específica | Resultado Esperado |
|---|---|---|
| V1 — Morador reporta impedimento; há candidato com carga abaixo do limite | POST /api/assignments/:id/impediment com morador elegível disponível | Tarefa redistribuída ao membro disponível com maior score/menor carga |
| V2 — Próximo candidato está no limite de carga | Redistribuição em que candidato 1 está no limite | Candidato ignorado; próximo candidato elegível buscado |
| V3 — Todos os moradores estão no limite de carga | Redistribuição sem candidato elegível disponível | [falta informacao: comportamento não especificado — tarefa fica sem responsável? Admin é notificado? Erro?] |
| V4 — Candidato a receber tem limitação física para a tarefa | Redistribuição em que próximo candidato tem limitação | Candidato ignorado (score = -Infinity); próximo elegível buscado |

---

### CT-24 — Alerta de tarefa de alta frequência sem responsável por 2 dias

**Técnica(s):** AVL
**Rastreabilidade:** RN-07

| Variante | Entrada/Condição Específica | Resultado Esperado |
|---|---|---|
| V1 — Tarefa semanal sem responsável há exatamente 2 dias corridos | Tarefa semanal com assignment sem membro por 2 dias | Alerta crítico emitido para o admin da casa |
| V2 — Tarefa semanal sem responsável há menos de 2 dias (ex: 1 dia) | Tarefa semanal sem atribuição por 1 dia | Nenhum alerta emitido |
| V3 — Tarefa diária sem responsável há 2 dias | Tarefa com frequência diária sem atribuição | [falta informacao: "frequência semanal ou maior" — confirmar se tarefas diárias também estão sob esta regra] |

---

### CT-25 — Troca manual de responsável na grade pelo admin

**Técnica(s):** PE
**Rastreabilidade:** RF-18

| Variante | Entrada/Condição Específica | Resultado Esperado |
|---|---|---|
| V1 — Admin troca responsável para morador elegível sem limitação | PATCH /api/houses/:id/distribution/:assignId com novo memberId elegível | Troca realizada; atribuição atualizada |
| V2 — Admin tenta trocar responsável para morador com limitação física | PATCH com memberId de morador com limitação para a tarefa | [falta informacao: se o sistema bloqueia a troca manual ou apenas exibe aviso] |
| V3 — Resident tenta fazer troca manual na grade | PATCH com token de resident | Acesso negado; retorna 403 |

---

### CT-26 — Exibição e confirmação da distribuição pelo admin

**Técnica(s):** TE
**Rastreabilidade:** RF-17

| Variante | Entrada/Condição Específica | Resultado Esperado |
|---|---|---|
| V1 — Admin aciona geração → visualiza distribuição em revisão | POST gera distribuição; GET retorna a grade | Grade de distribuição exibida antes de qualquer persistência definitiva |
| V2 — Admin confirma a distribuição | Ação de confirmação sobre a grade em revisão | Atribuições persistidas; moradores passam a ver tarefas no cronograma |
| V3 — Admin descarta a distribuição sem confirmar | Ação de cancelamento sobre a grade em revisão | Nenhuma atribuição persistida; cronogramas dos moradores inalterados |

---

## G6 — Cronograma e Visualização
> Valida calendário semanal do morador, visão mensal e anual do admin, reagendamento por drag and drop e sinalização visual de status das tarefas.

### CT-27 — Calendário semanal do morador com sinalização visual de status

**Técnica(s):** PE
**Rastreabilidade:** RF-20, RF-24

| Variante | Entrada/Condição Específica | Resultado Esperado |
|---|---|---|
| V1 — Morador acessa calendário semanal | GET /api/houses/:id/schedule/weekly com token de resident | Retorna apenas as tarefas atribuídas ao próprio morador na semana |
| V2 — Tarefa atribuída para o dia corrente | Calendário com tarefa no dia de hoje | Tarefa exibida com destaque visual distinto |
| V3 — Tarefa com data passada e status não concluída | Calendário com tarefa vencida sem conclusão | Sinalização visual de "atrasada" (cor/ícone distinto de pendente e concluída) |
| V4 — Tarefa marcada como concluída | Calendário com tarefa concluída | Sinalização visual de "concluída" (cor/ícone distinto) |
| V5 — Tarefa futura ainda não realizada | Calendário com tarefa futura | Sinalização visual de "pendente" (distinta de atrasada e concluída) |

---

### CT-28 — Visão mensal completa para admin

**Técnica(s):** PE
**Rastreabilidade:** RF-21

| Variante | Entrada/Condição Específica | Resultado Esperado |
|---|---|---|
| V1 — Admin acessa visão mensal | GET /api/houses/:id/schedule/monthly com token de admin | Tarefas de todos os moradores da casa exibidas para o mês |
| V2 — Resident tenta acessar visão mensal | GET com token de resident | Acesso negado; retorna 403 |

---

### CT-29 — Visão anual com indicadores de cobertura para admin

**Técnica(s):** PE
**Rastreabilidade:** RF-22

| Variante | Entrada/Condição Específica | Resultado Esperado |
|---|---|---|
| V1 — Admin acessa visão anual | GET /api/houses/:id/schedule/annual com token de admin | Indicadores de semanas com alta e baixa carga exibidos ao longo do ano |
| V2 — Definição dos thresholds de alta/baixa carga | Qualquer configuração de tarefas | [falta informacao: thresholds que caracterizam "alta" e "baixa" carga não estão quantificados nos requisitos] |
| V3 — Resident tenta acessar visão anual | GET com token de resident | Acesso negado; retorna 403 |

---

### CT-30 — Reagendamento de tarefas via drag and drop dentro da semana

**Técnica(s):** PE
**Rastreabilidade:** RF-23, RN-01

| Variante | Entrada/Condição Específica | Resultado Esperado |
|---|---|---|
| V1 — Morador arrasta tarefa sem dependência para outro dia na mesma semana | Drag and drop de tarefa independente para novo dia dentro do período semanal | Tarefa reagendada com sucesso; nova data salva |
| V2 — Morador tenta arrastar tarefa para fora da semana corrente | Drag and drop ultrapassando o limite da semana | [falta informacao: se o sistema bloqueia ou permite navegar para a próxima semana] |
| V3 — Morador tenta mover apenas uma tarefa de grupo com dependência | Drag and drop de uma tarefa do grupo sem mover as demais | [falta informacao: comportamento não definido — lacuna identificada na análise de requisitos (EP05-US04 × RN01)] |

---

## G7 — Notificações e Alertas
> Valida envio de e-mails de resumo diário, notificação de não conclusão, resumo semanal para admin e exibição de banner in-app.

### CT-31 — Envio do e-mail de resumo diário no horário configurado

**Técnica(s):** PE
**Rastreabilidade:** RF-25, RF-26

| Variante | Entrada/Condição Específica | Resultado Esperado |
|---|---|---|
| V1 — Morador configurou horário de envio do e-mail | Chegada do horário configurado pelo morador | E-mail de resumo diário enviado para o morador no horário configurado |
| V2 — Morador não configurou horário de envio | Chegada de horário padrão do sistema | [falta informacao: horário padrão de envio quando morador não configurou não está especificado] |
| V3 — Morador altera horário do e-mail | PATCH com novo horário válido | Novo horário salvo; aplicado a partir do próximo envio |

---

### CT-32 — E-mail de notificação de tarefa não concluída ao final do dia

**Técnica(s):** PE
**Rastreabilidade:** RF-27

| Variante | Entrada/Condição Específica | Resultado Esperado |
|---|---|---|
| V1 — Fim do dia com tarefa não concluída | Processamento de fim de dia com assignment pendente | E-mail de notificação enviado ao morador responsável |
| V2 — Fim do dia com todas as tarefas concluídas | Processamento de fim de dia sem assignments pendentes | Nenhum e-mail enviado |

---

### CT-33 — Resumo semanal por e-mail para o admin

**Técnica(s):** PE
**Rastreabilidade:** RF-28

| Variante | Entrada/Condição Específica | Resultado Esperado |
|---|---|---|
| V1 — Fim da semana com tarefas registradas | Processamento de fim de semana | E-mail enviado ao admin com percentual de tarefas concluídas e lista de tarefas em atraso da casa |
| V2 — Fim da semana sem admin ativo na casa | Processamento de fim de semana | [falta informacao: comportamento não especificado — e-mail ignorado? Enviado ao Gestor? Erro?] |

---

### CT-34 — Banner de alertas in-app ao abrir o sistema

**Técnica(s):** PE
**Rastreabilidade:** RF-29

| Variante | Entrada/Condição Específica | Resultado Esperado |
|---|---|---|
| V1 — Morador abre o sistema com tarefas no dia | Acesso à aplicação com assignments para o dia corrente | Banner exibido com tarefas do dia e pendências |
| V2 — Morador abre o sistema sem tarefas no dia | Acesso sem assignments no dia corrente | [falta informacao: se banner é exibido vazio ou não é exibido] |
| V3 — Comportamento do banner após o morador visualizar | Morador fecha ou ignora o banner | [falta informacao: se o banner pode ser descartado, por quanto tempo persiste e se reaparece ao reabrir o sistema] |

---

## G8 — Execução e Histórico
> Valida marcação de conclusão, adição de observação, acesso a relatórios de desempenho e política de retenção do histórico de execução.

### CT-35 — Marcação de tarefa como concluída

**Técnica(s):** TE
**Rastreabilidade:** RF-30

| Variante | Entrada/Condição Específica | Resultado Esperado |
|---|---|---|
| V1 — Morador conclui sua própria tarefa com um toque | PATCH /api/assignments/:id/complete com token do morador responsável | Status da atribuição alterado para "concluída" em uma única ação |
| V2 — Morador tenta concluir tarefa atribuída a outro morador | PATCH com token de morador não responsável pela atribuição | [falta informacao: se é possível concluir tarefa de outro morador ou é bloqueado] |
| V3 — Tarefa já concluída é marcada novamente | PATCH sobre atribuição com status já "concluída" | [falta informacao: se idempotente (retorna 200 sem alterar) ou retorna erro] |

---

### CT-36 — Adição de observação textual ao concluir tarefa

**Técnica(s):** PE
**Rastreabilidade:** RF-31

| Variante | Entrada/Condição Específica | Resultado Esperado |
|---|---|---|
| V1 — Morador conclui tarefa com observação textual | PATCH /api/assignments/:id/complete com campo de observação preenchido | Tarefa concluída e observação salva junto ao registro |
| V2 — Morador conclui tarefa sem observação | PATCH sem campo de observação | Tarefa concluída sem observação (campo é opcional) |
| V3 — Observação excede limite de caracteres | PATCH com observação muito longa | [falta informacao: limite de caracteres do campo de observação não especificado] |

---

### CT-37 — Relatório de desempenho por morador

**Técnica(s):** PE
**Rastreabilidade:** RF-32

| Variante | Entrada/Condição Específica | Resultado Esperado |
|---|---|---|
| V1 — Admin acessa relatório de desempenho | GET /api/houses/:id/reports/performance com token de admin | Relatório retornado com tarefas concluídas, atrasadas e evitadas por morador |
| V2 — Morador tenta acessar relatório de desempenho | GET com token de resident | [falta informacao: se morador tem acesso ao próprio relatório ou apenas o admin] |
| V3 — Relatório para período sem dados históricos | GET de relatório em período sem assignments registrados | Retorna resultado vazio sem erro; listas zeradas |

---

### CT-38 — Retenção do histórico de execução por dois anos

**Técnica(s):** AVL
**Rastreabilidade:** RF-33, RN-11

| Variante | Entrada/Condição Específica | Resultado Esperado |
|---|---|---|
| V1 — Registro de execução com menos de 2 anos | Consulta de histórico com assignment dentro do período de retenção | Registro retornado e visível nas consultas |
| V2 — Registro com exatamente 2 anos | Consulta de histórico com assignment na fronteira exata de 2 anos | [falta informacao: "até dois anos" é ambíguo — confirmar se o registro no limite é incluso ou excluído] |
| V3 — Registro com mais de 2 anos | Consulta de histórico com assignment fora do período de retenção | [falta informacao: comportamento não especificado — registro excluído automaticamente, arquivado ou apenas ignorado nas consultas] |

---

## Resumo de Cobertura

| Grupo | CTs | Rastreabilidade |
|---|---|---|
| G1 — Gestão de Casas e Membros | CT-01, CT-02, CT-03, CT-04, CT-05, CT-06 | RF-01, RF-02, RF-03, RF-04, RF-05, RN-08, RN-13, RN-14 |
| G2 — Catálogo de Tarefas | CT-07, CT-08, CT-09, CT-10, CT-11, CT-12 | RF-06, RF-07, RF-08, RF-09, RN-01, RN-12 |
| G3 — Preferências e Limitações Físicas | CT-13, CT-14, CT-15 | RF-10, RF-11, RF-12, RN-05, RN-10 |
| G4 — Pesos de Distribuição | CT-16, CT-17, CT-18, CT-19, CT-20 | RF-13, RF-14, RN-02, RN-03, RN-04, RN-09 |
| G5 — Distribuição Automática | CT-21, CT-22, CT-23, CT-24, CT-25, CT-26 | RF-15, RF-16, RF-17, RF-18, RF-19, RN-01, RN-06, RN-07 |
| G6 — Cronograma e Visualização | CT-27, CT-28, CT-29, CT-30 | RF-20, RF-21, RF-22, RF-23, RF-24 |
| G7 — Notificações e Alertas | CT-31, CT-32, CT-33, CT-34 | RF-25, RF-26, RF-27, RF-28, RF-29 |
| G8 — Execução e Histórico | CT-35, CT-36, CT-37, CT-38 | RF-30, RF-31, RF-32, RF-33, RN-11 |
| **Total** | **38 CTs** | **RF-01→33 e RN-01→14** |
