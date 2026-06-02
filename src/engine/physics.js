import { TYPES, ELEMENTS } from './elements';

export class PhysicsEngine {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.grid = new Uint8Array(width * height);
    this.nextGrid = new Uint8Array(width * height);
    // 복제 블록이 복제할 타겟을 저장하는 배열
    this.cloneTarget = new Uint8Array(width * height);
    this.sunTimer = 0;
    this.moonTimer = 0;
    this.lightningCooldown = 0;
    this.lightningCheckTimer = 600; // 10 seconds at 60fps
    this.lightningPhase = 0; // 0: none, 1: darkening, 2: brightening
    this.lightningPhaseTimer = 0;
    this.lightningTargetX = -1;
    this.lightningTargetY = -1;
    this.windTimer = 0;
    this.sunCooldown = 0;
    this.moonCooldown = 0;
    this.windCooldown = 0;
    this.toastMessage = null;
    this.rainbowTimer = 0;
    this.isRaining = false;
    this.clear();
  }

  clear() {
    this.grid.fill(TYPES.EMPTY);
    this.nextGrid.fill(TYPES.EMPTY);
    this.cloneTarget.fill(TYPES.EMPTY);
    this.sunTimer = 0;
    this.moonTimer = 0;
    this.windTimer = 0;
    this.sunCooldown = 0;
    this.moonCooldown = 0;
    this.windCooldown = 0;
    this.toastMessage = null;
    this.rainbowTimer = 0;
    this.isRaining = false;
    this.lightningCooldown = 0;
    this.lightningCheckTimer = 600;
    this.lightningPhase = 0;
    this.lightningPhaseTimer = 0;
  }

  getIndex(x, y) {
    return y * this.width + x;
  }

  set(x, y, id) {
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
      this.grid[this.getIndex(x, y)] = id;
    }
  }

  get(x, y) {
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
      return this.grid[this.getIndex(x, y)];
    }
    return TYPES.WALL; // Out of bounds acts like a wall
  }

  canMoveTo(x, y) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return false;
    const idx = this.getIndex(x, y);
    const curr = this.grid[idx];
    const next = this.nextGrid[idx];
    // Can only move to spaces that are CURRENTLY empty/gas AND will REMAIN empty/gas in the next frame
    const isCurrClear = curr === TYPES.EMPTY || (ELEMENTS[curr] && ELEMENTS[curr].type === 'gas');
    const isNextClear = next === TYPES.EMPTY || (ELEMENTS[next] && ELEMENTS[next].type === 'gas');
    return isCurrClear && isNextClear;
  }

  canSwapLiquid(x, y) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return false;
    const idx = this.getIndex(x, y);
    const curr = this.grid[idx];
    const next = this.nextGrid[idx];
    // Powders can swap with liquids
    const isCurrClear = curr === TYPES.EMPTY || (ELEMENTS[curr] && (ELEMENTS[curr].type === 'gas' || ELEMENTS[curr].type === 'liquid'));
    const isNextClear = next === TYPES.EMPTY || (ELEMENTS[next] && (ELEMENTS[next].type === 'gas' || ELEMENTS[next].type === 'liquid'));
    return isCurrClear && isNextClear;
  }

  swap(x1, y1, x2, y2) {
    const id1 = this.get(x1, y1);
    const id2 = this.get(x2, y2);
    this.nextGrid[this.getIndex(x1, y1)] = id2;
    this.nextGrid[this.getIndex(x2, y2)] = id1;
  }

  move(x, y, nx, ny, id) {
    this.nextGrid[this.getIndex(nx, ny)] = id;
    if (this.nextGrid[this.getIndex(x, y)] === id) { // Only clear if we haven't been replaced in nextGrid yet
      this.nextGrid[this.getIndex(x, y)] = TYPES.EMPTY;
    }
  }

  findPermeableEmpty(x, y, dx, dy, maxDist = 20) {
     for(let i=1; i<=maxDist; i++) {
        const nx = x + dx * i;
        const ny = y + dy * i;
        if (nx < 0 || nx >= this.width || ny < 0 || ny >= this.height) return null;
        
        const curr = this.grid[this.getIndex(nx, ny)];
        const next = this.nextGrid[this.getIndex(nx, ny)];
        
        // 잎이나 가지는 통과 가능
        const isPermeable = (curr === TYPES.TREE || curr === TYPES.WOOD || curr === TYPES.PLANT || curr === TYPES.LEAF_AUTUMN || curr === TYPES.FLOWER_PINK || curr === TYPES.FLOWER_1 || curr === TYPES.FLOWER_2 || curr === TYPES.FLOWER_3 || curr === TYPES.SEED);
        
        if (curr === TYPES.EMPTY && next === TYPES.EMPTY) {
           return {x: nx, y: ny};
        } else if (!isPermeable) {
           return null; // 막힘
        }
     }
     return null;
  }

  triggerLightning(startX, startY) {
    const branches = Math.floor(Math.random() * 3) + 1; // 1 to 3 branches
    for (let b = 0; b < branches; b++) {
      let x = startX;
      let y = startY;
      while (y < this.height) {
        if (y > startY) {
          this.nextGrid[this.getIndex(x, y)] = TYPES.LIGHTNING;
        }
        y++;
        x += Math.floor(Math.random() * 3) - 1; // -1, 0, 1
        if (x < 0) x = 0;
        if (x >= this.width) x = this.width - 1;
        
        const id = this.get(x, y);
        if (id !== TYPES.EMPTY && id !== TYPES.CLOUD && id !== TYPES.SMOKE && id !== TYPES.GAS && id !== TYPES.FIRE) {
          this.nextGrid[this.getIndex(x, y)] = TYPES.LIGHTNING;
          break;
        }
      }
    }
  }

  update() {
    // Cooldowns
    if (this.sunCooldown > 0) this.sunCooldown--;
    if (this.moonCooldown > 0) this.moonCooldown--;
    if (this.windCooldown > 0) this.windCooldown--;
    if (this.windTimer > 0) this.windTimer--;
    if (this.rainbowTimer > 0) this.rainbowTimer--;
    
    // Copy current grid to nextGrid as baseline
    this.nextGrid.set(this.grid);

    this.isEclipse = false;
    if (this.sunTimer > 0 && this.moonTimer > 0) {
      const sunX = Math.floor(((1200 - this.sunTimer) / 1200) * this.width);
      const moonX = Math.floor((this.moonTimer / 1200) * this.width);
      if (Math.abs(sunX - moonX) < 15) {
        this.isEclipse = true;
      }
    }
    
    // 일식 중에는 시간이 현재(0.5)보다 2배 더 느리게(0.25) 흘러 일식이 오래 지속되도록 변경
    const timeSpeed = this.isEclipse ? 0.25 : 1;
    this.isRaining = false;

    // Global Climate Effects
    if (this.sunTimer > 0) {
      this.sunTimer -= timeSpeed;
      for (let i = 0; i < 6; i++) {
        const rx = Math.floor(Math.random() * this.width);
        const ry = Math.floor(Math.random() * this.height);
        const rId = this.get(rx, ry);
        if (rId === TYPES.ICE) this.nextGrid[this.getIndex(rx, ry)] = TYPES.WATER;
        else if (rId === TYPES.WATER) this.nextGrid[this.getIndex(rx, ry)] = TYPES.STEAM;
        else if ((rId === TYPES.PLANT || rId === TYPES.TREE || rId === TYPES.SEED) && Math.random() < 0.5) {
           this.nextGrid[this.getIndex(rx, ry)] = TYPES.SAND;
        }
      }
    }
    if (this.moonTimer > 0) {
      this.moonTimer -= timeSpeed;
      // To keep the conversion rate consistent with half speed, we might only run the loop half the time
      // But 6 checks per frame is already small, we can keep it or use Math.random
      if (Math.random() < timeSpeed) {
        for (let i = 0; i < 6; i++) {
          const rx = Math.floor(Math.random() * this.width);
          const ry = Math.floor(Math.random() * this.height);
          const rId = this.get(rx, ry);
          if (rId === TYPES.WATER) {
             this.nextGrid[this.getIndex(rx, ry)] = TYPES.SNOW;
          } else if (rId === TYPES.SAND) {
             if (ry > 0 && this.get(rx, ry - 1) === TYPES.EMPTY) {
                this.nextGrid[this.getIndex(rx, ry - 1)] = TYPES.ICE;
             }
          }
        }
      }
    }

    // Lightning System
    if (this.lightningCooldown > 0) this.lightningCooldown--;

    if (this.lightningPhase === 1) {
      this.lightningPhaseTimer--;
      if (this.lightningPhaseTimer <= 0) {
        this.triggerLightning(this.lightningTargetX, this.lightningTargetY);
        this.lightningPhase = 2;
        this.lightningPhaseTimer = 300;
        this.lightningCooldown = 3600; // 60 seconds (1 minute at 60fps)
      }
    } else if (this.lightningPhase === 2) {
      this.lightningPhaseTimer--;
      if (this.lightningPhaseTimer <= 0) {
        this.lightningPhase = 0;
      }
    } else if (this.lightningCooldown === 0) {
      this.lightningCheckTimer--;
      if (this.lightningCheckTimer <= 0) {
        this.lightningCheckTimer = 600;
        let mixFound = false;
        let mixX = -1, mixY = -1;
        for (let idx = 0; idx < this.width * this.height; idx++) {
          if (this.grid[idx] === TYPES.CLOUD) {
            const rx = idx % this.width;
            const ry = Math.floor(idx / this.width);
            let localFound = false;
            for(let dx=-1; dx<=1; dx++) {
              for(let dy=-1; dy<=1; dy++) {
                if (this.get(rx+dx, ry+dy) === TYPES.SMOKE) {
                  mixFound = true;
                  mixX = rx;
                  mixY = ry;
                  localFound = true;
                  break;
                }
              }
              if (localFound) break;
            }
          }
          if(mixFound) break;
        }

        if (mixFound && Math.random() < 0.3) {
          this.lightningPhase = 1;
          this.lightningPhaseTimer = 300;
          this.lightningTargetX = mixX;
          this.lightningTargetY = mixY;
        }
      }
    }

    // Iterating bottom to top, randomly left/right
    for (let y = this.height - 1; y >= 0; y--) {
      const dir = Math.random() < 0.5 ? 1 : -1;
      const startX = dir === 1 ? 0 : this.width - 1;
      const endX = dir === 1 ? this.width : -1;

      for (let x = startX; x !== endX; x += dir) {
        const idx = this.getIndex(x, y);
        const id = this.grid[idx];
        if (id === TYPES.EMPTY || id === TYPES.WALL) continue;

        // If it already moved in nextGrid, skip it
        if (this.nextGrid[idx] !== id && this.nextGrid[idx] !== TYPES.EMPTY) {
           // It might have been swapped, but let's simplify: 
           // In cellular automata, usually we only process from current grid.
           // However, to prevent double processing, we'd need a separate "processed" array.
           // We will use a simplified approach without it for performance, but things might move twice.
        }

        const el = ELEMENTS[id];
        
        // --- BEHAVIORS ---

        // Energy (Lightning)
        if (el.type === 'energy') {
          if (id === TYPES.LIGHTNING) {
            this.nextGrid[idx] = TYPES.EMPTY;
            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                const nx = x + dx;
                const ny = y + dy;
                if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
                  const nid = this.get(nx, ny);
                  if (nid === TYPES.WATER) {
                    this.nextGrid[this.getIndex(nx, ny)] = TYPES.ELECTRIC_WATER;
                  } else if (nid === TYPES.SAND) {
                    this.nextGrid[this.getIndex(nx, ny)] = TYPES.EMPTY;
                  } else if (nid === TYPES.PLANT || nid === TYPES.TREE || nid === TYPES.SEED || nid === TYPES.WOOD) {
                    this.nextGrid[this.getIndex(nx, ny)] = TYPES.FIRE;
                  }
                }
              }
            }
          }
        }

        // Powder (Sand, Seed)
        else if (el.type === 'powder') {
          let moved = false;
          if (this.canSwapLiquid(x, y + 1)) {
            this.swap(x, y, x, y + 1);
            moved = true;
          } else {
            const perm = this.findPermeableEmpty(x, y, 0, 1, 15);
            if (perm) {
              this.swap(x, y, perm.x, perm.y);
              moved = true;
            }
          }

          if (!moved) {
            const canGoLeft = this.canSwapLiquid(x - 1, y + 1);
            const canGoRight = this.canSwapLiquid(x + 1, y + 1);
            
            if (canGoLeft && canGoRight) {
              if (Math.random() < 0.5) this.swap(x, y, x - 1, y + 1);
              else this.swap(x, y, x + 1, y + 1);
              moved = true;
            } else if (canGoLeft) {
              this.swap(x, y, x - 1, y + 1);
              moved = true;
            } else if (canGoRight) {
              this.swap(x, y, x + 1, y + 1);
              moved = true;
            } else {
               const pLeft = this.findPermeableEmpty(x, y, -1, 1, 10);
               const pRight = this.findPermeableEmpty(x, y, 1, 1, 10);
               if (pLeft && pRight) {
                  const target = Math.random() < 0.5 ? pLeft : pRight;
                  this.swap(x, y, target.x, target.y);
               } else if (pLeft) {
                  this.swap(x, y, pLeft.x, pLeft.y);
               } else if (pRight) {
                  this.swap(x, y, pRight.x, pRight.y);
               }
            }
          }
        }

        // Snow (drifting slowly downwards)
        else if (id === TYPES.SNOW) {
          // 가을바람 연출: 눈이 왼쪽 화면 밖으로 흩날리며 전체의 약 1/2이 서서히 소멸됨
          if (this.windTimer > 0) {
             let targetIdx = idx;
             let windMoved = false;
             
             if (Math.random() < 0.8) { // 왼쪽으로 빠르게 이동
                const dx = -1;
                const dy = Math.random() < 0.5 ? -1 : 0;
                if (x === 0) {
                   this.nextGrid[idx] = TYPES.EMPTY; // 화면 왼쪽 끝에 닿으면 즉시 소멸
                   continue;
                } else if (this.canMoveTo(x + dx, y + dy)) {
                   this.swap(x, y, x + dx, y + dy);
                   targetIdx = this.getIndex(x + dx, y + dy);
                   windMoved = true;
                }
             }
             if (Math.random() < 0.00115) { // 10초 동안 정확히 전체의 1/2 소멸 확률
                this.nextGrid[targetIdx] = TYPES.EMPTY;
                continue;
             }
             
             if (windMoved) continue; // 바람에 의해 이동한 프레임은 중력(낙하) 처리를 건너뛰어 복제 버그 방지
          }

          // Melting logic
          if (this.moonTimer === 0) {
             const meltChance = this.sunTimer > 0 ? 0.0016 : 0.0008;
             if (Math.random() < meltChance) {
                // 수분이 차오르는 이질적인 연출을 막기 위해 눈이 물로 변하지 않고 자연스럽게 증발(소멸)되도록 수정
                this.nextGrid[idx] = TYPES.EMPTY;
                continue;
             }
          }

          if (Math.random() < 0.3) {
            let moved = false;
            if (this.canSwapLiquid(x, y + 1)) {
              this.swap(x, y, x, y + 1);
              moved = true;
            } else {
              const perm = this.findPermeableEmpty(x, y, 0, 1, 15);
              if (perm) {
                 this.swap(x, y, perm.x, perm.y);
                 moved = true;
              }
            }

            if (!moved) {
              const canGoLeft = this.canSwapLiquid(x - 1, y + 1);
              const canGoRight = this.canSwapLiquid(x + 1, y + 1);
              if (canGoLeft && canGoRight) {
                if (Math.random() < 0.5) this.swap(x, y, x - 1, y + 1);
                else this.swap(x, y, x + 1, y + 1);
              } else if (canGoLeft) {
                this.swap(x, y, x - 1, y + 1);
              } else if (canGoRight) {
                this.swap(x, y, x + 1, y + 1);
              } else {
                 const pLeft = this.findPermeableEmpty(x, y, -1, 1, 10);
                 const pRight = this.findPermeableEmpty(x, y, 1, 1, 10);
                 if (pLeft && pRight) {
                    const target = Math.random() < 0.5 ? pLeft : pRight;
                    this.swap(x, y, target.x, target.y);
                 } else if (pLeft) {
                    this.swap(x, y, pLeft.x, pLeft.y);
                 } else if (pRight) {
                    this.swap(x, y, pRight.x, pRight.y);
                 }
              }
            }
          }
        }

        // Falling Solid (drops straight down only)
        else if (el.type === 'falling_solid') {
          if (this.canSwapLiquid(x, y + 1)) {
            this.swap(x, y, x, y + 1);
          } else {
            const perm = this.findPermeableEmpty(x, y, 0, 1, 15);
            if (perm) {
              this.swap(x, y, perm.x, perm.y);
            }
          }
        }

        // Liquid (Water, Lava, Acid)
        else if (el.type === 'liquid') {
          if (id === TYPES.WATER && this.moonTimer > 0) {
             if (this.canMoveTo(x, y + 1) || this.canMoveTo(x - 1, y + 1) || this.canMoveTo(x + 1, y + 1)) {
                // 눈이 내리는 양을 0.05로 최종 조정 (적당히 소복소복 쌓이는 예쁜 양)
                if (Math.random() < 0.05) {
                   this.nextGrid[idx] = TYPES.SNOW;
                } else {
                   this.nextGrid[idx] = TYPES.EMPTY;
                }
                continue;
             }
          }

          if (id === TYPES.ELECTRIC_WATER && Math.random() < 0.05) {
             this.nextGrid[idx] = TYPES.WATER;
          }
          let moved = false;
          if (this.canMoveTo(x, y + 1)) {
            this.swap(x, y, x, y + 1);
            moved = true;
          } else {
             const perm = this.findPermeableEmpty(x, y, 0, 1, 15);
             if (perm) {
                this.swap(x, y, perm.x, perm.y);
                moved = true;
             }
          }

          if (!moved) {
            const canGoLeft = this.canMoveTo(x - 1, y + 1);
            const canGoRight = this.canMoveTo(x + 1, y + 1);
            
            if (canGoLeft && canGoRight) {
              if (Math.random() < 0.5) this.swap(x, y, x - 1, y + 1);
              else this.swap(x, y, x + 1, y + 1);
              moved = true;
            } else if (canGoLeft) {
              this.swap(x, y, x - 1, y + 1);
              moved = true;
            } else if (canGoRight) {
              this.swap(x, y, x + 1, y + 1);
              moved = true;
            } else {
               const pLeft = this.findPermeableEmpty(x, y, -1, 1, 10);
               const pRight = this.findPermeableEmpty(x, y, 1, 1, 10);
               if (pLeft && pRight) {
                  const target = Math.random() < 0.5 ? pLeft : pRight;
                  this.swap(x, y, target.x, target.y);
                  moved = true;
               } else if (pLeft) {
                  this.swap(x, y, pLeft.x, pLeft.y);
                  moved = true;
               } else if (pRight) {
                  this.swap(x, y, pRight.x, pRight.y);
                  moved = true;
               }
            }

            if (!moved) {
              // spread horizontally further (water pooling effect)
              const maxSpread = 5;
              let canL = true;
              let canR = true;
              let targetX = x;

              let lx = x;
              for (let i = 1; i <= maxSpread; i++) {
                if (canL && this.canMoveTo(x - i, y)) {
                  lx = x - i;
                  if (this.canMoveTo(lx, y + 1)) break; // Found a drop
                } else canL = false;
              }

              let rx = x;
              for (let i = 1; i <= maxSpread; i++) {
                if (canR && this.canMoveTo(x + i, y)) {
                  rx = x + i;
                  if (this.canMoveTo(rx, y + 1)) break; // Found a drop
                } else canR = false;
              }

              const distL = x - lx;
              const distR = rx - x;
              if (distL > 0 && distR > 0) targetX = (Math.random() < 0.5) ? lx : rx;
              else if (distL > 0) targetX = lx;
              else if (distR > 0) targetX = rx;
              
              if (targetX !== x) this.swap(x, y, targetX, y);
            }
          }

          // Lava interactions
          if (id === TYPES.LAVA) {
             for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                const neighbor = this.get(x + dx, y + dy);
                if (neighbor === TYPES.WATER) {
                  this.nextGrid[this.getIndex(x + dx, y + dy)] = TYPES.STONE;
                  if (Math.random() < 0.5) this.nextGrid[idx] = TYPES.STONE;
                  if (y > 0 && this.get(x, y - 1) === TYPES.EMPTY) {
                     this.nextGrid[this.getIndex(x, y - 1)] = TYPES.STEAM;
                  }
                  if (this.toastMessage === null && !this.lavaToastShown) {
                     this.toastMessage = "앗 뜨거워! 펄펄 끓는 용암이 차가운 물을 만나면 굳어서 단단한 돌이 된답니다!";
                     this.lavaToastShown = true;
                  }
                } else if (neighbor === TYPES.ICE) {
                  this.nextGrid[this.getIndex(x + dx, y + dy)] = TYPES.WATER;
                } else if (ELEMENTS[neighbor] && ELEMENTS[neighbor].flammable) {
                  this.nextGrid[this.getIndex(x + dx, y + dy)] = TYPES.FIRE;
                }
              }
            }
          }

          // Acid interactions
          if (id === TYPES.ACID) {
            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;
                const neighbor = this.get(x + dx, y + dy);
                if (neighbor !== TYPES.EMPTY && neighbor !== TYPES.WALL && neighbor !== TYPES.ACID) {
                  if (Math.random() < 0.1) {
                    this.nextGrid[this.getIndex(x + dx, y + dy)] = TYPES.EMPTY;
                    if (Math.random() < 0.5) this.nextGrid[idx] = TYPES.EMPTY; // Acid gets consumed
                  }
                }
              }
            }
          }
        }

        // Gas (Fire, Smoke, Gas, Cloud, Steam)
        else if (el.type === 'gas') {
          // Gas moves randomly up
          let targetIdx = idx;
          let newX = x;
          let newY = y;
          let moved = false;
          
          if (Math.random() < 0.6) {
             const upId = this.get(x, y - 1);
             if (this.canMoveTo(x, y - 1) || (this.canSwapLiquid(x, y - 1) && upId !== TYPES.LAVA && ELEMENTS[upId] && ELEMENTS[upId].type === 'liquid')) {
                this.swap(x, y, x, y - 1);
                targetIdx = this.getIndex(x, y - 1);
                newY = y - 1;
                moved = true;
             }
          }
          if (!moved) {
             const dx = (Math.random() < 0.5 ? -1 : 1);
             if (this.canMoveTo(x + dx, y)) {
               this.swap(x, y, x + dx, y);
               targetIdx = this.getIndex(x + dx, y);
               newX = x + dx;
             } else if (this.canMoveTo(x - dx, y)) {
               this.swap(x, y, x - dx, y);
               targetIdx = this.getIndex(x - dx, y);
               newX = x - dx;
             }
          }

          if (id === TYPES.FIRE) {
             // Burn things
             for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                const neighbor = this.get(newX + dx, newY + dy);
                const nEl = ELEMENTS[neighbor];
                if (nEl && nEl.flammable && Math.random() < nEl.flammable) {
                  if (neighbor === TYPES.GAS) {
                     this.explode(newX + dx, newY + dy, 3, TYPES.FIRE); // Gas explodes in a chain reaction!
                  } else {
                     this.nextGrid[this.getIndex(newX + dx, newY + dy)] = TYPES.FIRE;
                  }
                }
                if (neighbor === TYPES.ICE && Math.random() < 0.2) {
                  this.nextGrid[this.getIndex(newX + dx, newY + dy)] = TYPES.WATER;
                }
                if (neighbor === TYPES.FIREWORK) {
                   // Ignite firework!
                   this.nextGrid[this.getIndex(newX + dx, newY + dy)] = TYPES.FIREWORK_ACTIVE;
                }
              }
            }
            // 정확한 연소 과정 (평균 3초 / 180프레임 후 연기로 변함)
            if (Math.random() < 0.0055) {
              this.nextGrid[targetIdx] = TYPES.SMOKE; // Fire dies to smoke
            }
          }
          
          if (id === TYPES.SMOKE) {
             // 정확한 소멸 과정 (평균 6초 / 360프레임 후 소멸)
             if (Math.random() < 0.0027) {
                this.nextGrid[targetIdx] = TYPES.EMPTY; // dissipate much slower
             }
          }
          if (id === TYPES.STEAM) {
             if (newY < 15) {
                if (Math.random() < 0.05) {
                   this.nextGrid[targetIdx] = TYPES.CLOUD;
                   if (this.toastMessage === null && !this.waterCycleToastShown) {
                      this.toastMessage = "햇빛을 받은 물이 뜨거워져서 수증기로 변해 하늘로 올라가 구름이 되었어요!";
                      this.waterCycleToastShown = true;
                   }
                }
             } else if (Math.random() < 0.01) {
                this.nextGrid[targetIdx] = TYPES.EMPTY;
             }
          }
          if (id === TYPES.CLOUD) {
             // 확률적으로 주변 밀도를 검사하여 비를 내리게 함
             if (Math.random() < 0.01) {
               let cloudCount = 0;
               const checkRadius = 5;
               for (let cy = newY - checkRadius; cy <= newY + checkRadius; cy++) {
                 for (let cx = newX - checkRadius; cx <= newX + checkRadius; cx++) {
                   if (cx >= 0 && cx < this.width && cy >= 0 && cy < this.height) {
                     if (this.grid[this.getIndex(cx, cy)] === TYPES.CLOUD) cloudCount++;
                   }
                 }
               }
               // 해(반지름 7.5) 크기 이상으로 밀도가 높아지면 (약 80픽셀 이상)
               if (cloudCount > 80) {
                 this.nextGrid[targetIdx] = TYPES.WATER; // 구름이 물(비)로 변환
                 if (this.canMoveTo(newX, newY + 1)) {
                    this.nextGrid[this.getIndex(newX, newY + 1)] = TYPES.WATER; // 물방울을 추가 생성하여 비를 무겁게 만듦
                 }
               }
             }
          }
        }

        // Fireworks Automatic Timer
        if (id === TYPES.FIREWORK) {
           // ~1 sec per stage (1/60 chance per frame)
           if (Math.random() < 0.016) {
              this.nextGrid[idx] = TYPES.FIREWORK_STAGE1;
           }
        } else if (id === TYPES.FIREWORK_STAGE1) {
           if (Math.random() < 0.016) {
              this.nextGrid[idx] = TYPES.FIREWORK_STAGE2;
           }
        } else if (id === TYPES.FIREWORK_STAGE2) {
           if (Math.random() < 0.016) {
              this.nextGrid[idx] = TYPES.FIREWORK_ACTIVE;
           }
        }

        // Spark
        else if (el.type === 'spark') {
           // 터진 후 아주 짧은 시간(거의 즉시)에 흩어지며 사라짐
           if (Math.random() < 0.08) {
              this.nextGrid[idx] = TYPES.EMPTY;
           }
        }

        // Bug (Ant)
        else if (el.type === 'bug') {
          if (this.canSwapLiquid(x, y + 1)) {
            this.swap(x, y, x, y + 1); // Fall
          } else {
            // Digging behavior: if touching sand, chance to dig
            let digged = false;
            if (Math.random() < 0.1) {
              const digDirs = [{dx:0,dy:1}, {dx:-1,dy:1}, {dx:1,dy:1}, {dx:-1,dy:0}, {dx:1,dy:0}, {dx:0,dy:-1}];
              const dir = digDirs[Math.floor(Math.random() * digDirs.length)];
              const targetIdx = this.getIndex(x + dir.dx, y + dir.dy);
              if (this.grid[targetIdx] === TYPES.SAND && this.nextGrid[targetIdx] === TYPES.SAND) {
                 this.nextGrid[targetIdx] = TYPES.EMPTY;
                 this.swap(x, y, x + dir.dx, y + dir.dy);
                 digged = true;
              }
            }
            if (!digged) {
               // Normal walking
               const dx = Math.random() < 0.5 ? -1 : 1;
               if (this.canMoveTo(x + dx, y) && !this.canMoveTo(x + dx, y + 1)) {
                 this.swap(x, y, x + dx, y);
               } else if (this.canMoveTo(x + dx, y - 1)) {
                 this.swap(x, y, x + dx, y - 1); // Climb
               }
            }
          }
        }

        // Biological Growth (Seed, Plant)
        if (id === TYPES.SEED || id === TYPES.PLANT) {
          let touchedWater = false;
          let waterX = -1, waterY = -1;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (this.get(x + dx, y + dy) === TYPES.WATER) {
                touchedWater = true;
                waterX = x + dx;
                waterY = y + dy;
              }
            }
          }

          if (touchedWater) {
            // 물 흡수 속도 1/2로 감소 (기존 0.2 -> 0.1)
            if (Math.random() < 0.1) {
              this.nextGrid[this.getIndex(waterX, waterY)] = TYPES.EMPTY;
            }
            
            // 씨앗이 새싹으로 변하는 속도 대폭 감소 (천천히 올라옴)
            if (id === TYPES.SEED) {
              if (Math.random() < 0.05) {
                this.nextGrid[idx] = TYPES.PLANT;
              }
            }
            
            // 새싹 성장 속도 1/2로 감소 (기존 0.2 -> 0.1)
            if (id === TYPES.PLANT && Math.random() < 0.1) {
              const growDirs = [
                {dx: 0, dy: -1}, {dx: -1, dy: -1}, {dx: 1, dy: -1}, {dx: -1, dy: 0}, {dx: 1, dy: 0}
              ];
              const dir = growDirs[Math.floor(Math.random() * growDirs.length)];
              const target = this.get(x + dir.dx, y + dir.dy);
              if (target === TYPES.EMPTY) {
                 // 자라날 때 10% 확률로 알록달록한 꽃 피우기
                 if (Math.random() < 0.1) {
                   const flowers = [TYPES.FLOWER_1, TYPES.FLOWER_2, TYPES.FLOWER_3];
                   this.nextGrid[this.getIndex(x + dir.dx, y + dir.dy)] = flowers[Math.floor(Math.random() * flowers.length)];
                 } else {
                   this.nextGrid[this.getIndex(x + dir.dx, y + dir.dy)] = TYPES.PLANT;
                 }
              }
            }
          }
        }

        if (id === TYPES.PLANT || id === TYPES.TREE) {
           if (this.windTimer > 0 && Math.random() < 0.02) {
              if (this.canSwapLiquid(x, y+1) || Math.random() < 0.1) {
                 this.nextGrid[idx] = TYPES.LEAF_AUTUMN;
                 if (this.toastMessage === null && !this.autumnToastShown) {
                    this.toastMessage = "가을이 오면 나뭇잎이 예쁘게 물들고, 겨울을 준비하기 위해 땅으로 떨어져요!";
                    this.autumnToastShown = true;
                 }
              }
           }
        }

        // Tree Growth
        if (id === TYPES.TREE) {
          let touchedWater = false;
          let waterX = -1, waterY = -1;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (this.get(x + dx, y + dy) === TYPES.WATER) {
                touchedWater = true;
                waterX = x + dx;
                waterY = y + dy;
              }
            }
          }

          if (touchedWater) {
            // 물 흡수 속도 감소 (기존 0.3 -> 0.15)
            if (Math.random() < 0.15) {
              this.nextGrid[this.getIndex(waterX, waterY)] = TYPES.EMPTY;
            }
            
            if (Math.random() < 0.2) {
               const bBelow = this.get(x, y + 1);
               // 기둥(WOOD) 바로 위거나 바닥일 때 메인 기둥(Trunk)으로 성장 가능
               const isTrunk = (bBelow === TYPES.WOOD || bBelow === TYPES.SAND || bBelow === TYPES.STONE);
               
               // 나무가 너무 두꺼워지지 않도록, 위가 비어있을 때만 성장
               if (isTrunk && this.get(x, y - 1) === TYPES.EMPTY) {
                  // 75% 확률로 위로 기둥 성장
                  if (Math.random() < 0.75) {
                     this.nextGrid[idx] = TYPES.WOOD;
                     this.nextGrid[this.getIndex(x, y - 1)] = TYPES.TREE;
                     
                     // 기둥 양옆에 잎(TREE)을 남겨 풍성하게 만듦
                     if (Math.random() < 0.7 && this.get(x - 1, y) === TYPES.EMPTY) {
                        this.nextGrid[this.getIndex(x - 1, y)] = TYPES.TREE;
                     }
                     if (Math.random() < 0.7 && this.get(x + 1, y) === TYPES.EMPTY) {
                        this.nextGrid[this.getIndex(x + 1, y)] = TYPES.TREE;
                     }
                  } else {
                     // 25% 확률로 대각선으로 살짝 뻗음 (자연스러운 굴곡)
                     const dirX = Math.random() < 0.5 ? -1 : 1;
                     if (this.get(x + dirX, y - 1) === TYPES.EMPTY) {
                        this.nextGrid[idx] = TYPES.WOOD;
                        this.nextGrid[this.getIndex(x + dirX, y - 1)] = TYPES.TREE;
                     }
                  }
               } else {
                  // 기둥이 아니라면 잎(Canopy)으로 풍성하게 퍼짐
                  let emptyCount = 0;
                  for(let dy=-1; dy<=1; dy++){
                     for(let dx=-1; dx<=1; dx++){
                        if(this.get(x+dx, y+dy) === TYPES.EMPTY) emptyCount++;
                     }
                  }
                  
                  // 빈 공간이 4개 이상일 때만 확장 (둥글고 예쁜 형태 유지, 무한증식 방지)
                  if (emptyCount >= 4 && Math.random() < 0.4) {
                     const growDirs = [
                        {dx: -1, dy: -1}, {dx: 1, dy: -1}, 
                        {dx: -1, dy: 0}, {dx: 1, dy: 0},
                        {dx: 0, dy: -1}, {dx: 0, dy: 1}
                     ];
                     const dir = growDirs[Math.floor(Math.random() * growDirs.length)];
                     const tx = x + dir.dx;
                     const ty = y + dir.dy;
                     
                     if (tx >= 0 && tx < this.width && ty >= 0 && ty < this.height) {
                        if (this.get(tx, ty) === TYPES.EMPTY) {
                           // 10% 꽃, 90% 잎
                           if (Math.random() < 0.1) {
                              const flowers = [TYPES.FLOWER_1, TYPES.FLOWER_2, TYPES.FLOWER_3];
                              this.nextGrid[this.getIndex(tx, ty)] = flowers[Math.floor(Math.random() * flowers.length)];
                           } else {
                              this.nextGrid[this.getIndex(tx, ty)] = TYPES.TREE;
                           }
                        }
                     }
                  }
               }
            }
          } else {
             // 물에 닿지 않은 잎사귀들은 시간이 지나면 서서히 벚꽃으로 변함
             if (Math.random() < 0.002) {
                this.nextGrid[idx] = TYPES.FLOWER_PINK;
             }
          }
        }

        // Clone
        if (id === TYPES.CLONE) {
          let currentTarget = this.cloneTarget[idx];
          if (currentTarget === TYPES.EMPTY) {
            // Find a target to clone
            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                const neighbor = this.get(x + dx, y + dy);
                if (neighbor !== TYPES.EMPTY && neighbor !== TYPES.CLONE && neighbor !== TYPES.WALL) {
                   // 불과 관련된 원소들(불, 연기, 가스, 폭죽, 수증기, 용암, 산성)은 복제 대상에서 제외
                   const isFireRelated = [TYPES.FIRE, TYPES.SMOKE, TYPES.LAVA, TYPES.ACID, TYPES.FIREWORK, TYPES.FIREWORK_STAGE1, TYPES.FIREWORK_STAGE2, TYPES.FIREWORK_ACTIVE, TYPES.GAS, TYPES.STEAM].includes(neighbor);
                   if (!isFireRelated) {
                      this.cloneTarget[idx] = neighbor;
                      currentTarget = neighbor;
                      break;
                   }
                }
              }
              if (this.cloneTarget[idx] !== TYPES.EMPTY) break;
            }
          } 
          
          if (currentTarget !== TYPES.EMPTY) {
            // Clone the target around it
             for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                const neighbor = this.get(x + dx, y + dy);
                if (neighbor === TYPES.EMPTY) {
                   if (currentTarget === TYPES.WATER) {
                      // 고인 물 여부 판단: 물이 아래나 대각선 아래로 떨어질 수 있는지 확인
                      const canFall = this.canSwapLiquid(x, y + 1) || this.canSwapLiquid(x - 1, y + 1) || this.canSwapLiquid(x + 1, y + 1);
                      if (canFall && Math.random() < 0.013) { // 떨어지는 물만 복제하며, 기존 복제량의 1/3 수준으로 추가 축소 (0.013)
                         this.nextGrid[this.getIndex(x + dx, y + dy)] = currentTarget;
                      }
                   } else {
                      if (Math.random() < 0.2) {
                        this.nextGrid[this.getIndex(x + dx, y + dy)] = currentTarget;
                      }
                   }
                }
              }
             }
          }
        }

        // FIREWORK_ACTIVE: Ascends rapidly
        if (id === TYPES.FIREWORK_ACTIVE) {
          // Move up by 1 or 2 pixels
          const dy = Math.random() < 0.5 ? -1 : -2;
          if (this.canMoveTo(x, y + dy)) {
            this.swap(x, y, x, y + dy);
            // Leave smoke or fire trail
            if (Math.random() < 0.6) {
              this.nextGrid[this.getIndex(x, y)] = Math.random() < 0.5 ? TYPES.FIRE : TYPES.SMOKE;
            }
          } else {
            // Hit something, explode early
            this.explodeFirework(x, y);
          }
          // Explode at top 1/3 of the screen
          if (y < this.height / 3 && Math.random() < 0.1) {
             this.explodeFirework(x, y);
          }
        }

        // Sparks: fall slowly and disappear
        if (id === TYPES.SPARK_YELLOW || id === TYPES.SPARK_PINK || id === TYPES.SPARK_BLUE || id === TYPES.SPARK_GREEN) {
           if (Math.random() < 0.05) {
              this.nextGrid[idx] = TYPES.EMPTY; // Disappear
           } else {
              // Fall like snow
              if (Math.random() < 0.5) {
                if (this.canSwapLiquid(x, y + 1)) {
                  this.swap(x, y, x, y + 1);
                } else {
                  const dx = Math.random() < 0.5 ? -1 : 1;
                  if (this.canSwapLiquid(x + dx, y + 1)) {
                    this.swap(x, y, x + dx, y + 1);
                  }
                }
              }
           }
        }
        if (id === TYPES.CLONE) {
          const currentTarget = this.cloneTarget[idx];
          if (currentTarget === TYPES.EMPTY) {
            // Find a target to clone
            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                const neighbor = this.get(x + dx, y + dy);
                if (neighbor !== TYPES.EMPTY && neighbor !== TYPES.CLONE && neighbor !== TYPES.WALL) {
                  this.cloneTarget[idx] = neighbor;
                  break;
                }
              }
            }
          } else {
            // Clone the target around it
             for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                const neighbor = this.get(x + dx, y + dy);
                if (neighbor === TYPES.EMPTY) {
                   if (Math.random() < 0.2) {
                     this.nextGrid[this.getIndex(x + dx, y + dy)] = currentTarget;
                   }
                }
              }
             }
          }
        }
      }
    }

    // Apply nextGrid back to grid
    this.grid.set(this.nextGrid);

    // Rainbow logic
    if (this.sunTimer > 0 && this.isRaining) {
      this.rainbowTimer = 300;
      if (this.toastMessage === null && !this.rainbowToastShown) {
         this.toastMessage = "비가 올 때 햇빛이 비치면, 물방울이 빛을 꺾어 예쁜 무지개를 만들어요!";
         this.rainbowToastShown = true;
      }
    }
  }

  explode(cx, cy, radius, type) {
    for (let y = cy - radius; y <= cy + radius; y++) {
      for (let x = cx - radius; x <= cx + radius; x++) {
        if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
          const dx = x - cx;
          const dy = y - cy;
          if (dx*dx + dy*dy <= radius*radius) {
            const current = this.get(x, y);
            if (current !== TYPES.WALL) {
               if (Math.random() < 0.8) {
                 this.nextGrid[this.getIndex(x, y)] = type;
               } else {
                 this.nextGrid[this.getIndex(x, y)] = TYPES.EMPTY;
               }
            }
          }
        }
      }
    }
  }

  explodeFirework(cx, cy) {
    // 1. Base Explosion (Red/Orange Fire)
    this.nextGrid[this.getIndex(cx, cy)] = TYPES.EMPTY; // Remove the active firework
    this.explode(cx, cy, 3, TYPES.FIRE);
    
    // 2. Spread 5-8 branches of fire
    const branches = 5 + Math.floor(Math.random() * 4);
    for (let i = 0; i < branches; i++) {
       const angle = (Math.PI * 2 / branches) * i;
       const dist = 5 + Math.random() * 10;
       const bx = Math.floor(cx + Math.cos(angle) * dist);
       const by = Math.floor(cy + Math.sin(angle) * dist);
       if (bx >= 0 && bx < this.width && by >= 0 && by < this.height) {
          this.explode(bx, by, 2, TYPES.FIRE);
       }
    }

    // 3. Pattern (Flower, Heart, Spaceship, Rabbit)
    const patterns = [
      // 0: Yellow Flower
      { type: TYPES.SPARK_YELLOW, points: [[0,0], [0,-2], [0,-3], [-1,-1], [-2,0], [-3,0], [-1,1], [0,2], [0,3], [1,1], [2,0], [3,0]] },
      // 1: Pink Heart
      { type: TYPES.SPARK_PINK, points: [[0,3], [-1,2], [-2,1], [-3,0], [-3,-1], [-2,-2], [-1,-2], [0,-1], [1,-2], [2,-2], [3,-1], [3,0], [2,1], [1,2]] },
      // 2: Blue Spaceship
      { type: TYPES.SPARK_BLUE, points: [[0,-3], [-1,-1], [1,-1], [-2,1], [2,1], [-3,2], [3,2], [-1,3], [1,3], [0,0]] },
      // 3: Green Rabbit
      { type: TYPES.SPARK_GREEN, points: [[-1,-3], [-1,-2], [1,-3], [1,-2], [0,-1], [-2,0], [2,0], [-2,1], [2,1], [-1,2], [0,2], [1,2]] }
    ];

    const selected = patterns[Math.floor(Math.random() * patterns.length)];
    const scale = 2; // Scale up the pattern
    
    for (const [px, py] of selected.points) {
       const targetX = cx + (px * scale);
       const targetY = cy + (py * scale);
       if (targetX >= 0 && targetX < this.width && targetY >= 0 && targetY < this.height) {
          // Fill a small 2x2 or 3x3 box for each point so it's visible
          for(let dy = -1; dy <= 1; dy++) {
             for(let dx = -1; dx <= 1; dx++) {
                if (Math.random() < 0.8) {
                   const finalX = targetX + dx;
                   const finalY = targetY + dy;
                   if (finalX >= 0 && finalX < this.width && finalY >= 0 && finalY < this.height && this.get(finalX, finalY) !== TYPES.WALL) {
                      this.nextGrid[this.getIndex(finalX, finalY)] = selected.type;
                   }
                }
             }
          }
       }
    }
  }

  render(ctx, imageData) {
    const data = imageData.data;
    for (let i = 0; i < this.grid.length; i++) {
      const id = this.grid[i];
      const color = ELEMENTS[id].color;
      const idx = i * 4;
      data[idx] = color[0];
      data[idx + 1] = color[1];
      data[idx + 2] = color[2];
      data[idx + 3] = id === TYPES.EMPTY ? 0 : 255;
    }
    ctx.putImageData(imageData, 0, 0);

    if (this.rainbowTimer > 0) {
      const cx = this.width / 2;
      const cy = this.height / 2 + 50;
      const maxRadius = this.width / 2 - 20;
      const colors = ['#ff0000', '#ff7f00', '#ffff00', '#00ff00', '#0000ff', '#4b0082', '#9400d3'];
      
      ctx.save();
      ctx.globalAlpha = (this.rainbowTimer > 60 ? 1 : this.rainbowTimer / 60) * 0.5;
      for (let i = 0; i < colors.length; i++) {
         ctx.beginPath();
         ctx.arc(cx, cy, maxRadius - i * 5, Math.PI, 0);
         ctx.lineWidth = 5;
         ctx.strokeStyle = colors[i];
         ctx.stroke();
      }
      ctx.restore();
    }

    // Draw Sun and Moon as UI overlays directly on the canvas
    const drawCelestial = (timer, color, isSun) => {
      const p = isSun ? (1200 - timer) / 1200 : timer / 1200; // 0.0 to 1.0
      const startX = 0;
      const endX = this.width;
      const highestY = this.height / 6;
      const startY = this.height / 2;
      
      const cx = startX + p * (endX - startX);
      const cy = highestY + 4 * (startY - highestY) * (p - 0.5) * (p - 0.5);
      
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(cx, cy, 10, 0, 2 * Math.PI);
      ctx.fill();
    };

    if (this.sunTimer > 0) {
      drawCelestial(this.sunTimer, '#ffdc32', true);
    }
    if (this.moonTimer > 0) {
      drawCelestial(this.moonTimer, '#c8c8ff', false);
    }
  }
}
