# War UFO

RTS single-player em Phaser 3. Você comanda um líder, recruta mineradores, soldados e espiões,
gasta moedas em upgrades e cumpre os objetivos de cada missão.

## Rodar

O jogo usa módulos ES, então precisa de um servidor HTTP (não abre por `file://`):

```
npm start        # http://localhost:8080
```

## Controles

| Ação | Tecla / mouse |
|---|---|
| Mover o comandante / atirar no alien | clique esquerdo no chão / no alien |
| Câmera | setas ou arrastar com o mouse |
| Zoom | `+` / `-` |
| Atirar no cursor / no alien mais próximo | botão direito / `Espaço` |
| Usar item do inventário | `1` a `4` ou clique no slot |
| Upgrades | `P` |
| Painel de stats | `U` |
| Minimapa | `M` |
| Auto-resposta dos soldados | `K` |
| Fog of war | `O` |
| Debug: grid, visão dos NPCs | `G`, `Y` |

## Estrutura

| Arquivo | Responsabilidade |
|---|---|
| `main.js`, `LobbyScene.js`, `GameScene.js` | Configuração do Phaser e cenas |
| `config.js` | Constantes, armas, unidades, NPCs, upgrades e mapa |
| `progression.js` | Missões (dados), objetivos e upgrades |
| `game-manager.js` | Orquestrador; junta os módulos abaixo |
| `input-manager.js` | Mouse, teclado, câmera e zoom |
| `combat-manager.js` | Tiro, dano, armadura, morte e efeitos |
| `unit-manager.js` | Criação, seleção, formação e movimento das unidades |
| `economy.js` | Moedas, transmissão, mineração e inventário |
| `game-ui.js` | Painel de stats, mensagens e tela de fim de jogo |
| `npc-manager.js` | IA dos aliens (patrulha, perseguição, recuo) e drops |
| `cenario.js`, `path-manager.js` | Mapa, grid, linha de visão e pathfinding (EasyStar) |
| `ShotManager.js`, `animation-manager.js`, `sound-manager.js`, `minimap.js`, `ui-manager.js` | Efeitos, animações, áudio, minimapa e HUD |

## Itens

Todos os itens ficam na tabela `ITEMS` em `config.js`. Para criar um: uma entrada na tabela e uma imagem em `assets/items/`.

| Item | Efeito |
|---|---|
| Moeda | +$10 ao tocar (não ocupa slot) |
| Medkit | +20 de vida (pilha de até 3) |
| Escopeta | Equipa e desequipa a arma; fica no inventário |
| Bomba | Mata todos os aliens num raio de 350 (não atinge guardas nem suas unidades) |
| Granada | 40 de dano num raio de 150 no NPC mais próximo (pilha de até 3) |
| Adrenalina | Comandante 50% mais rápido por 8 s |

Item no chão some em 30 s. Inventário: 4 slots, compartilhado e guardado no comandante.

## Criar uma missão

Acrescente um objeto em `MISSIONS` (`progression.js`). Tipos de objetivo: `transmit`, `eliminate`, `mine`.

## Créditos

Veja o botão CREDITS no lobby e os arquivos `assets/new/*_credits.txt`.
