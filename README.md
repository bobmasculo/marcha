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

## Criar uma missão

Acrescente um objeto em `MISSIONS` (`progression.js`). Tipos de objetivo: `transmit`, `eliminate`, `mine`.

## Créditos

Veja o botão CREDITS no lobby e os arquivos `assets/new/*_credits.txt`.
