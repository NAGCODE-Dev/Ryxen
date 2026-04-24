# Plano de prontidão de mercado do Ryxen

Este documento define o que falta para o Ryxen sair de um produto tecnicamente sólido e virar um produto pronto para vender.

A tese central é simples:

```txt
Não falta código. Falta confiança, clareza e distribuição.
```

O objetivo não é adicionar mais features. O objetivo é provar que coaches conseguem usar, entender valor e querer pagar.

## Diagnóstico honesto

O Ryxen já tem base técnica forte:

- app atleta
- coach portal
- backend
- autenticação
- importação de treinos
- benchmarks
- assinatura/grace period
- PWA/Android
- estrutura multi-tenant

Mas produto pronto para mercado exige outra camada:

```txt
usuário entende sozinho -> tem primeira vitória -> volta a usar -> percebe valor -> aceita pagar
```

Se qualquer parte desse fluxo quebra, o produto ainda não está pronto para escalar.

## Meta da primeira validação

Antes de escalar, validar com poucos usuários reais.

Meta mínima:

```txt
3 a 5 coaches usando por 7 dias reais
1 coach tentando pagar ou aceitando pagar manualmente
1 fluxo completo coach -> treino -> atleta funcionando sem explicação direta
```

## O que significa “pronto para vender”

O Ryxen está pronto para vender quando:

- um coach cria conta sozinho
- cria ou entra em um gym
- publica um treino em menos de 5 minutos
- entende onde os atletas veem o treino
- consegue explicar o valor do app sem ajuda
- volta no dia seguinte
- aceita pagar ou pergunta preço

## Fase 1 — Onboarding como prioridade máxima

O onboarding é o maior gargalo.

Pergunta principal:

```txt
Um coach consegue criar conta e publicar o primeiro treino em menos de 5 minutos?
```

Se a resposta for “mais ou menos”, o foco deve ser onboarding.

### Checklist de onboarding

Implementar ou revisar:

- checklist guiado pós-cadastro
- criação automática de gym no primeiro acesso
- atleta fake/demo para teste
- treino exemplo pronto para publicar
- CTA único: “Publicar primeiro treino”
- tela de sucesso depois da publicação
- explicação clara de onde o atleta verá o treino

### Primeira vitória

A primeira vitória do coach deve ser:

```txt
“publiquei um treino e vi como meu aluno receberia”
```

Não deve ser:

```txt
“configurei um monte de coisa”
```

## Fase 2 — Teste brutal com coaches

Teste com usuários reais, não com dev.

Roteiro:

1. Escolher 3 a 5 coaches pequenos.
2. Mandar o link/app.
3. Não explicar o produto antes.
4. Dar apenas a tarefa:

```txt
Cria um treino e manda para 3 alunos.
```

5. Observar onde travam.
6. Anotar linguagem exata usada por eles.
7. Corrigir o fluxo antes de adicionar features.

### O que medir

- tempo até criar conta
- tempo até criar gym
- tempo até publicar treino
- número de dúvidas
- onde desistiram
- se entenderam o valor
- se voltaram no dia seguinte
- se perguntaram preço

### Resultado esperado

Ao final do teste, deve existir uma lista curta de problemas reais:

```txt
não entendeu gym
não achou botão de publicar
não entendeu diferença entre atleta e coach
não viu confirmação
não sabe como aluno acessa
achou caro/barato/confuso
```

## Fase 3 — Billing mínimo vendável

O billing não precisa ser perfeito no começo, mas precisa ser confiável.

O link externo da Kiwify pode servir para o lançamento inicial, desde que o usuário entenda o status.

### Mínimo necessário

- botão claro de assinar
- página de planos clara
- status de assinatura visível
- mensagem clara durante grace period
- ativação manual ou automática confiável
- canal de suporte caso pagamento não ative

### Evitar no início

- sistema complexo de planos
- cupons elaborados
- automação de billing antes de validar demanda
- gastar semanas otimizando checkout sem usuários reais

## Fase 4 — UX óbvia no mobile

O produto vive ou morre no celular.

Critério:

```txt
Um coach com pressa consegue publicar treino no intervalo de uma aula?
```

### Pontos críticos

- botões principais grandes
- menos termos técnicos
- menos telas intermediárias
- preview claro do treino
- feedback depois de salvar/publicar
- estados vazios com instrução
- navegação inferior consistente

### Teste prático

Dar o app para alguém e pedir:

```txt
Cria um treino, publica e confirma onde o aluno vai ver.
```

Sem explicar.

Se a pessoa perguntar “onde clico agora?”, existe problema de UX.

## Fase 5 — Retenção e motivo para voltar

Depois que o coach publica um treino, ele precisa ter motivo para voltar.

Loops possíveis:

- treino novo publicado
- atleta viu treino
- atleta registrou resultado
- ranking atualizado
- evolução do atleta visível
- benchmark comparável
- lembrete de treino do dia

### Loop mínimo para MVP

```txt
Coach publica treino -> atleta visualiza -> atleta registra resultado -> coach vê retorno
```

Sem esse loop, o app vira ferramenta de cadastro e perde frequência.

## Fase 6 — Página de vendas que realmente vende

A landing/pricing precisa responder dúvidas comerciais, não só mostrar planos.

Perguntas que a página precisa responder:

- por que trocar do WhatsApp/planilha?
- quanto tempo o coach economiza?
- como o atleta recebe treino?
- como melhora acompanhamento?
- tem teste?
- posso cancelar?
- funciona no celular?
- preciso instalar algo?

### Promessa principal sugerida

```txt
Publique treinos, acompanhe alunos e organize seu box sem depender de WhatsApp e planilhas.
```

### Estrutura mínima da landing

```txt
Hero com promessa clara
Problema atual do coach
Como o Ryxen resolve
Fluxo em 3 passos
Prints reais
Planos
FAQ
CTA final
```

## Fase 7 — Suporte e confiança

Antes de escalar, o usuário precisa sentir que existe alguém por trás.

Mínimo necessário:

- email ou WhatsApp de suporte visível
- resposta rápida no piloto
- página simples de ajuda
- mensagem de erro humana
- termos básicos de privacidade/uso

Produto pequeno pode parecer confiável se o suporte for rápido.

## Checklist mínimo de lançamento

Pode lançar piloto pago se existir:

- login/cadastro funcionando
- reset de senha funcionando
- coach cria gym
- coach publica treino
- atleta vê treino
- atleta registra algo simples
- coach enxerga retorno
- billing manual ou link funcionando
- suporte visível
- onboarding em menos de 5 minutos
- 1 coach usando de verdade

Não precisa ainda:

- arquitetura perfeita
- billing extremamente automatizado
- app cheio de automações
- dashboards avançados
- escala grande
- dezenas de features

## Riscos principais

### Risco 1 — Produto bom, dor fraca

O coach pode achar legal, mas não necessário.

Sinal de alerta:

```txt
“muito massa, vou ver depois”
```

Sinal bom:

```txt
“consigo usar isso na minha turma de amanhã?”
```

### Risco 2 — Onboarding confuso

Se precisa explicar demais, ainda não está vendável.

### Risco 3 — Valor comercial pouco claro

Se a landing não mostra economia de tempo, organização e retenção, o preço vira objeção.

### Risco 4 — Retenção baixa

Se o coach publica uma vez e nunca mais volta, o produto ainda não criou loop.

## Métricas simples do piloto

Durante o piloto, acompanhar:

```txt
Coaches convidados
Coaches cadastrados
Coaches que criaram gym
Coaches que publicaram treino
Atletas adicionados
Atletas que visualizaram treino
Atletas que registraram resultado
Coaches que voltaram no dia seguinte
Coaches que perguntaram preço
Coaches que aceitaram pagar
```

## Plano de 14 dias

### Dias 1–2

- revisar onboarding
- criar treino exemplo
- criar gym demo
- ajustar CTA principal

### Dias 3–4

- revisar fluxo de publicação
- revisar tela de sucesso
- revisar status de assinatura
- adicionar suporte visível

### Dias 5–7

- chamar 3 coaches
- acompanhar uso real
- anotar travas
- não criar feature nova sem evidência

### Dias 8–10

- corrigir gargalos encontrados
- melhorar copy da landing
- ajustar FAQ
- preparar cobrança manual/link

### Dias 11–14

- chamar mais 2 coaches
- tentar primeira cobrança
- medir retorno diário
- decidir se está pronto para piloto pago maior

## Definition of Done

O Ryxen está pronto para sair do modo dev quando:

```txt
3 coaches completaram o fluxo sem ajuda pesada
1 coach aceitou pagar ou tentou pagar
onboarding entrega primeira vitória em menos de 5 minutos
coach entende o valor sem explicação longa
atleta consegue acessar treino no celular
suporte está visível
landing responde por que trocar do WhatsApp/planilha
```

## Norte final

O risco agora não é técnico.

O risco é construir mais código antes de provar uso real.

A próxima versão boa do Ryxen não é a versão com mais features.

É a versão que um coach entende, usa e quer pagar.
