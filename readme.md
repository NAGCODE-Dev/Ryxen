# 💪 Treino do Dia — PWA Offline-First

> Visualizador inteligente de treinos de musculação com cálculo automático de cargas baseado em PRs.
https://nikolasagc.github.io/CrossApp/
## 🎯 Visão

Aplicativo Progressive Web App (PWA) **100% offline**, sem frameworks, sem build step, versionável e escalável. Pensado para evolução contínua, contribuições externas e manutenção de longo prazo.

---

## 🧠 Princípios Arquiteturais

### **1. Separação rigorosa de responsabilidades**
- **Core**: lógica de negócio pura (zero DOM, zero infra)
- **Adapters**: implementações plugáveis (storage, PDF)
- **UI**: camada burra (recebe dados prontos, renderiza)

### **2. Inversão de dependência**
- Core **não importa** de adapters ou UI
- Adapters **implementam contratos** definidos pelo core
- UI **consome** use-cases do core

### **3. Estado centralizado reativo**
- Single source of truth (`core/state/store.js`)
- Reatividade via pub/sub simples (sem Redux, sem complexidade)
- Selectors para dados derivados

### **4. Use-cases em vez de controllers**
- 1 arquivo = 1 caso de uso
- Funções puras sempre que possível
- Testável sem mock excessivo

### **5. Git-friendly**
- Commits atômicos por camada
- Histórico legível
- Rollback cirúrgico

---

## 🚫 O que este projeto NÃO usa

❌ **React, Vue, Angular, Svelte** → JS puro  
❌ **Webpack, Vite, Parcel** → ES Modules nativos  
❌ **TypeScript** → JS com JSDoc (opcional)  
❌ **Tailwind, Bootstrap** → CSS puro com variáveis  
❌ **Classes pesadas** → Funções puras + objetos simples  
❌ **Redux, MobX** → State reativo próprio (pub/sub)  

---

## 📁 Estrutura do Projeto

/
├── src/
│ ├── core/ # Lógica de negócio pura
│ │ ├── state/ # Estado global + reatividade
│ │ ├── events/ # Event bus (pub/sub)
│ │ ├── usecases/ # Casos de uso (1 arquivo = 1 função)
│ │ ├── services/ # Lógica compartilhada
│ │ └── utils/ # Funções puras auxiliares
│ │
│ ├── adapters/ # Implementações de infra
│ │ ├── storage/ # localStorage + IndexedDB
│ │ └── pdf/ # Leitura e parse de PDF
│ │
│ ├── ui/ # Interface visual
│ │ ├── components/ # Componentes reutilizáveis
│ │ ├── screens/ # Telas completas
│ │ ├── actions.js # Event delegation
│ │ └── router.js # Troca de telas
│ │
│ ├── app.js # Inicialização + DI
│ └── main.js # Entry point
│
├── index.html
├── manifest.json
└── sw.js

text

---

## 🔧 Como Rodar Localmente

```bash
# Servir com servidor HTTP simples
npx http-server . -p 3000

# Ou com Python
python3 -m http.server 3000

# Ou com Node.js
npx serve .
Acesse: http://localhost:3000

🧪 Filosofia de Testes
Core: testável com funções puras (sem DOM)

Adapters: mockáveis por design

UI: testável via snapshots de HTML

(Testes serão adicionados incrementalmente)

🚀 Roadmap
✅ Fase 1 — Fundação (atual)
 Arquitetura definida

 State/store reativo

 Event bus funcional

 Utils básicos

🟡 Fase 2 — Core Services
 Parsing de treinos

 Cálculo de cargas

 Gerenciamento de PRs

🟡 Fase 3 — Adapters
 Storage (localStorage + IndexedDB)

 Leitura de PDF

 Persistência de PRs

🟡 Fase 4 — UI
 Tela de treino do dia

 Modal de PRs

 Configurações

🔮 Futuro
 Múltiplos PDFs/semanas

 Histórico de treinos

 Gráficos de progressão

 Sincronização em nuvem (opcional)

🤝 Contribuindo
Princípios para PRs:

Core isolado: não importe de ui/ ou adapters/

Funções puras: sempre que possível

Commits atômicos: 1 feature = 1 commit

Zero breaking changes: arquitetura é imutável

📜 Licença
MIT — use, modifique, distribua livremente.

🧑‍💻 Autor
Projeto pessoal criado para resolver um problema real: visualizar treinos de musculação offline com cálculo automático de cargas.

Arquitetado para durar anos, não semanas.
