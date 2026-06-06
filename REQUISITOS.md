# Casa Comigo — Requisitos do Sistema

## Visão do Produto

> **"Casa Comigo"** é uma plataforma web de gestão doméstica colaborativa que distribui tarefas de forma inteligente e justa entre os moradores, respeitando preferências individuais, agrupando atividades por eficiência e mantendo todos engajados com lembretes e visibilidade do progresso.

---

## Personas

| Persona | Descrição |
|---------|-----------|
| **Administrador da Casa** | Morador responsável por configurar o sistema, cadastrar membros, definir pesos de distribuição e gerenciar o catálogo de tarefas |
| **Gestor de Catálogo** | Morador com permissão delegada pelo administrador para criar, editar e remover tarefas do catálogo |
| **Morador** | Membro da residência que recebe tarefas, registra preferências e acompanha suas atividades |

---

## Níveis de Acesso

> **Regra de negócio RN06:** Existem três níveis de acesso:

| Nível | Quem atribui | O que pode fazer |
|-------|-------------|------------------|
| **Administrador** | Criador da casa | Tudo — membros, catálogo, distribuição, relatórios |
| **Gestor de Catálogo** | Administrador | Gerenciar catálogo de tarefas + visualizar cronograma completo |
| **Morador** | Padrão | Ver próprias tarefas, registrar preferências, marcar conclusão |

---

## Épicos e User Stories

### EP01 — Gestão da Casa e Membros

**EP01-US01** — Como administrador, quero criar uma "casa" e convidar moradores, para que todos possam participar do sistema.

**EP01-US02** — Como administrador, quero definir o número de moradores e seus perfis (nome, foto, disponibilidade semanal), para que a distribuição seja personalizada.

**EP01-US03** — Como morador, quero acessar o sistema com minha conta, para que eu veja apenas minhas tarefas e informações.

**EP01-US04** — Como administrador, quero conceder a um morador a permissão de **Gestor de Catálogo**, para que ele possa criar, editar e remover tarefas sem precisar ser administrador da casa.

**EP01-US05** — Como administrador, quero revogar a permissão de Gestor de Catálogo de um morador a qualquer momento, sem remover o membro da casa.

---

### EP02 — Catálogo de Tarefas Domésticas

**EP02-US01** — Como administrador ou gestor de catálogo, quero ter acesso a um catálogo pré-definido de tarefas domésticas comuns, para não precisar criar tudo do zero.

**EP02-US02** — Como administrador ou gestor de catálogo, quero criar, editar e remover tarefas personalizadas, para adaptar o sistema à realidade da nossa casa.

**EP02-US03** — Como administrador ou gestor de catálogo, quero definir para cada tarefa:
- Frequência (diária, semanal, quinzenal, mensal, trimestral, anual)
- Duração estimada
- Nível de esforço (leve, médio, pesado)
- Cômodo/área da casa associada
- Dependências de ordem com outras tarefas (ex.: "espanar" deve preceder "varrer")

**EP02-US04** — Como sistema, quero agrupar automaticamente tarefas do mesmo cômodo e com dependências de ordem, para que o morador execute de forma sequencial e eficiente.

> **Regra de negócio RN01:** Tarefas com dependência de ordem nunca podem ser atribuídas a dias ou momentos diferentes na mesma sessão de execução. Ex.: espanar → varrer → passar pano são sempre sequenciais quando agendadas juntas.

---

### EP03 — Registro de Preferências e Pesos de Distribuição

**EP03-US01** — Como morador, quero classificar cada tarefa em uma escala de preferência (ex.: odeio / neutro / gosto), para que o sistema saiba minhas afinidades.

**EP03-US02** — Como morador, quero marcar tarefas que tenho limitação física para realizar, para que o sistema nunca me atribua essas atividades.

**EP03-US03** — Como sistema, quero considerar as preferências na distribuição, priorizando atribuir a cada morador tarefas que ele prefere e evitando as que ele odeia, garantindo ao mesmo tempo distribuição justa de esforço total.

**EP03-US04** — Como administrador, quero definir um **peso de distribuição (%)** para cada morador, para que a geração automática respeite proporções diferentes de carga entre os membros da casa.

Exemplos de uso:
- Casa com 2 adultos e 1 criança de 10 anos → adultos 40% / 40% / criança 20%
- Um morador trabalha em turno noturno → ele recebe menos tarefas nos dias úteis
- Morador temporariamente sobrecarregado → reduz seu percentual até normalizar

**EP03-US05** — Como administrador, quero visualizar um painel de balanceamento que mostre o % de esforço atual de cada morador versus o % definido, para identificar desvios antes de confirmar a distribuição.

> **Regra de negócio RN02:** A distribuição de esforço segue os pesos percentuais definidos pelo administrador. Os pesos devem somar 100%. O desvio tolerado por morador é de ±10 pontos percentuais do peso definido (configurável). Se nenhum peso for definido, o sistema aplica distribuição igualitária automaticamente.

> **Regra de negócio RN03:** Tarefa com limitação física registrada nunca é atribuída ao morador limitado.

> **Regra de negócio RN07:** O administrador pode ajustar os pesos a qualquer momento. Ao fazer isso, o sistema exibe um alerta perguntando se deseja redistribuir os períodos futuros ou manter o planejamento atual.

---

### EP04 — Distribuição Inteligente de Tarefas

**EP04-US01** — Como administrador, quero acionar a distribuição automática de tarefas para o período desejado (semana, mês, trimestre ou ano inteiro), para ter um cronograma pronto.

**EP04-US02** — Como sistema, quero calcular a distribuição considerando:
- Frequência de cada tarefa
- Preferências de cada morador
- Pesos de distribuição por morador
- Equilíbrio de esforço e quantidade
- Disponibilidade semanal declarada
- Agrupamentos eficientes por cômodo e dependência de ordem

**EP04-US03** — Como administrador, quero visualizar a distribuição gerada antes de confirmá-la, para poder fazer ajustes manuais.

**EP04-US04** — Como administrador, quero trocar uma tarefa de morador manualmente na grade, para corrigir situações específicas.

**EP04-US05** — Como sistema, quero redistribuir automaticamente uma tarefa quando o morador reportar impedimento, para que ela não fique sem responsável.

> **Regra de negócio RN04:** Redistribuição automática não pode aumentar carga de morador que já está no limite de esforço definido pelo seu peso.

> **Regra de negócio RN05:** Tarefas com frequência semanal ou maior não podem ficar sem responsável por mais de 2 dias corridos.

---

### EP05 — Cronograma Visual

**EP05-US01** — Como morador, quero visualizar um calendário semanal com minhas tarefas do dia destacadas, para saber o que fazer hoje.

**EP05-US02** — Como administrador, quero visualizar a visão mensal de toda a casa, com todas as tarefas de todos os moradores, para ter visão de gestão.

**EP05-US03** — Como administrador, quero visualizar a visão anual com indicadores de cobertura (semanas com alta/baixa carga), para identificar desequilíbrios no planejamento.

**EP05-US04** — Como morador, quero arrastar e soltar tarefas no calendário para reagendar dentro da semana, para ter flexibilidade sem perder o compromisso.

**EP05-US05** — Como sistema, quero sinalizar visualmente tarefas atrasadas, concluídas e pendentes com cores distintas, para facilitar o acompanhamento rápido.

---

### EP06 — Lembretes e Notificações

> Na versão web inicial, notificações são entregues por **e-mail** e por **alertas in-app**. Push notification é funcionalidade prevista para fase futura com app mobile.

| Tipo de lembrete | Canal (Web v1) | Canal (Futuro mobile) |
|-----------------|----------------|----------------------|
| Resumo diário de tarefas | E-mail + in-app | Push + e-mail |
| Tarefa não concluída no fim do dia | E-mail | Push |
| Resumo semanal para admin | E-mail | Push + e-mail |
| Redistribuição atribuída a você | In-app + e-mail | Push |

**EP06-US01** — Como morador, quero receber um e-mail no início do dia com resumo das minhas tarefas do dia, para não esquecer nada.

**EP06-US02** — Como morador, quero configurar o horário de envio do meu e-mail de lembrete diário, para que chegue quando for mais útil.

**EP06-US03** — Como morador, quero receber um e-mail de tarefa não concluída ao final do dia, para decidir se concluo ou reprogramo.

**EP06-US04** — Como administrador, quero receber um resumo semanal por e-mail do status da casa (% concluído, tarefas em atraso), para acompanhar sem precisar abrir o sistema.

**EP06-US05** — Como morador, quero ver um banner de alertas ao abrir o sistema com as tarefas do dia e eventuais pendências, para não depender de verificar o e-mail.

---

### EP07 — Acompanhamento e Histórico

**EP07-US01** — Como morador, quero marcar uma tarefa como concluída com um toque, para registrar minha execução.

**EP07-US02** — Como morador, quero adicionar uma observação ao concluir uma tarefa (ex.: "produto acabou", "precisa de manutenção"), para comunicar algo aos outros moradores.

**EP07-US03** — Como administrador, quero visualizar relatórios de desempenho por morador (tarefas concluídas, atrasadas, evitadas), para conversas de alinhamento justas.

**EP07-US04** — Como sistema, quero manter histórico de execução de até 2 anos, para análise de padrões e melhoria da distribuição futura.

---

## Requisitos Não Funcionais

| ID | Categoria | Requisito |
|----|-----------|-----------|
| RNF01 | Usabilidade | Interface responsiva — desktop e mobile browser |
| RNF02 | Usabilidade | Interface operável com uma mão em telas mobile |
| RNF03 | Performance | Calendário deve carregar em menos de 2s para qualquer período |
| RNF04 | Disponibilidade | Sistema disponível 99,5% do tempo |
| RNF05 | Segurança | Dados de uma casa nunca visíveis para moradores de outra casa |
| RNF06 | Offline | Visualização do cronograma e marcação de conclusão funcionam offline no browser, sincronizando ao reconectar |
| RNF07 | Notificações | v1: e-mail transacional + alertas in-app. Push notification previsto para fase mobile |
| RNF08 | Acessibilidade | Contraste e tamanho de fonte acessíveis (WCAG AA) |

---

## Regras de Negócio Consolidadas

| ID | Regra |
|----|-------|
| RN01 | Tarefas com dependência de ordem são sempre agendadas em sequência na mesma sessão |
| RN02 | Distribuição de esforço segue pesos % por morador (somam 100%); desvio tolerado ±10pp (configurável); sem pesos definidos aplica distribuição igualitária |
| RN03 | Tarefa com limitação física registrada nunca é atribuída ao morador limitado |
| RN04 | Redistribuição automática não pode aumentar carga de morador que já está no limite de esforço pelo seu peso |
| RN05 | Tarefas com frequência semanal ou maior não podem ficar sem responsável por mais de 2 dias corridos |
| RN06 | Três níveis de acesso: Administrador (tudo), Gestor de Catálogo (catálogo + leitura), Morador (próprias tarefas) |
| RN07 | Ao alterar pesos de distribuição, sistema pergunta se redistribui períodos futuros ou mantém planejamento atual |

---