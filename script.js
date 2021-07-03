/*
Copyright 2021 Ioannis Katsios <ioannis.katsios1@gmail.com>

Permission is hereby granted, free of charge, to any person obtaining 
a copy of this software and associated documentation files (the 
"Software"), to deal in the Software without restriction, including 
without limitation the rights to use, copy, modify, merge, publish, 
distribute, sublicense, and/or sell copies of the Software, and to 
permit persons to whom the Software is furnished to do so, subject to 
the following conditions:

The above copyright notice and this permission notice shall be included 
in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS 
OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF 
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. 
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY 
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, 
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE 
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

/* 
TODO: Saving high-scores.
TODO: Actual UI with buttons to pause, start a new game / restart.
TODO: "About" info.
TODO: Statistics + time.
TODO: Resizing of board depending on window size.
*/

/* 
Trying to replicate the look of some of this GIF: https://commons.wikimedia.org/wiki/File:Tetris_Game_4-Line_Clear.gif
and to follow the SRS (Super Rotation System): https://harddrop.com/wiki/SRS 
*/

/* 
Factory functions 
2D Vector factory function. 
*/
function createVec2(x,y) {
    return {
        x: x,
        y: y,

        // In-place methods.
        add(other) {
            this.x += other.x;
            this.y += other.y;
        },

        sub(other) {
            this.x -= other.x;
            this.y -= other.y;
        },

        copy() {
            return createVec2(this.x, this.y);
        },

        stringify() {
            return `{x: ${this.x}, y: ${this.y}}`;
        }
    }
}

// Drawing wrapper functions.
function drawLine(ctx, from, to, color) {
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.strokeStyle = color;
    ctx.stroke();
}

function fillRect3(ctx, from, width, height, color) {
    ctx.fillStyle = color;
    ctx.fillRect(from.x, from.y, width, height);
} 

function drawText(ctx, text, text_position, font, font_size, alignment, color) {
    ctx.font = `${font_size}px ${font}`;
    ctx.fillStyle = color;
    ctx.textAlign = alignment;
    ctx.fillText(text, text_position.x, text_position.y);       
}

function clearCanvasElement(ctx, width, height, color) {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, width, height);
}

// Color factory function.
function createColor(r,g,b) {
    return {
        r: r,
        g: g,
        b: b,

        rgb() {
            return `rgb(${this.r}, ${this.g}, ${this.b})`;
        },
    
        rgba(a) {
            return `rgba(${this.r}, ${this.g}, ${this.b}, ${a})`;
        }
    };
}

// Tetromino colors.
const PURPLE = createColor(160, 32, 240);
const BLUE = createColor(25, 64, 255);
const ORANGE = createColor(255, 126, 0);
const MAGENTA = createColor(255,77,196);
const CYAN = createColor(0, 183, 235);
const RED = createColor(255, 51, 51);
const GREEN = createColor(0, 255, 42);

// Board background colors.
const bgColor1 = createColor(255, 241, 107);
const bgColor2 = createColor(243, 232, 130);

// 'Board' represents the tetris board and manages itself: what is drawn in it and where w.r.t. board-space.
function createBoard(ctx, width, height, block_width, block_height, offset, wallkick_data) {
    // Initialize block array.
    const arr = new Array(width, height);
    for (let elem = 0; elem < width * height; elem++) {
        arr[elem] = {
            hasBlock: false, 
            color: ''
        };
    }

    // Internal offset used for hiding the first 2 rows.
    let internal_offset = offset.copy();
    internal_offset.y -= 2 * block_width;

    return {
        ctx: ctx,     
        width: width,              
        height: height,
        block_width: block_width,
        block_height: block_height,
        offset: offset,
        internal_offset: internal_offset,
        wallkick_data: wallkick_data,
        arr: arr,

        set(x, y, color) {
            this.arr[this.width * y + x].hasBlock = true;
            this.arr[this.width * y + x].color = color;
        },
    
        getColor(x, y) {
            return this.arr[this.width * y + x].color;
        },
    
        hasBlock(x, y) {
            return this.arr[this.width * y + x].hasBlock;
        },
    
        // Clears the block at point (x,y) of board-space.
        clearBlock(x, y) {
            /* Just toggle the hasBlock boolean to false.
            The color property is irrelevant to whether
            a block is drawn or not. */
            this.arr[this.width * y + x].hasBlock = false;
        },
    
        // Return an array with all board-space y-coordinates of full lines.
        getFullLinesY() {
            const fullLinesY = new Array();
            for (let y = 0; y < this.height; y++) {
                let counter = 0;
                for (let x = 0; x < this.width; x++) {
                    if (this.hasBlock(x,y)) {
                        counter++;
                    } 
                }
                if (counter === this.width) {
                    fullLinesY.push(y);
                }
            }
            return fullLinesY;
        },
    
        // Deletes lines, which are passed as an array of y-coordinates in board space.
        deleteLines(fullLinesY) {
            // Find highest line with blocks.
            let upperY = -1;
            for (let y = 0; y < this.height; y++) {
                for (let x = 0; x < this.width; x++) {
                    if (this.hasBlock(x, y)) {
                        upperY = y;
                        break;
                    }
                }
                if (upperY !== -1) {
                    break;
                }
            }
           
            for (let h of fullLinesY) {
                /* Move lines one line downwards by copying the uppermost line 
                with blocks is reached, then delete that line. */
                for (let y = h; y > upperY; y--) {
                    for (let x = 0; x < this.width; x++) {
                        if (this.hasBlock(x, y - 1)) {
                            this.set(x, y, this.getColor(x, y - 1));
                        } else {
                            this.clearBlock(x, y);
                        }                        
                    }
                }

                for (let x = 0; x < this.width; x++) {
                    this.clearBlock(x, upperY);
                }
                
                /* Increment the uppermost y-coordinate by 1 (y increases downwards),
                since the highest line containing blocks was moved downwards by 1. */
                upperY++;
            }
        },

        /* 
        Draws a block at a certain position. No check on whether it's drawn inside of the board or not,
        in order to draw the next/held tetromino w.r.t. the position of the tetris board. 
        */
        drawBlock(x, y, color) {
            let from = createVec2((this.block_width + 1) * x + 1, this.block_height * y);
            from.add(this.internal_offset);          
            fillRect3(this.ctx, from, this.block_width, this.block_height - 1, color);
        },

        drawHalfBlock(x, y, color) {
            let from = createVec2((this.block_width + 1) * x + 1, this.block_height * (y * 1.5));
            from.add(this.internal_offset);            
            fillRect3(this.ctx, from, this.block_width, this.block_height / 2 - 1, color);
        },

        drawText(x, y, text, font, font_size, alignment, color) {
            let text_position = createVec2((this.block_width + 1) * x + 1, this.block_height * y);
            text_position.add(this.internal_offset);      
            drawText(this.ctx, text, text_position, font, font_size, alignment, color);     
        },
    
        // Draw the background of the board.
        drawBackground() {
            for (let x = 0; x < this.width; x++) {
                let start = createVec2(x * (this.block_width + 1) + 1, 0);
                start.add(this.offset);

                let color = bgColor1.rgb();
                if (x % 2 === 0) {
                    color = bgColor2.rgb();
                } 

                fillRect3(this.ctx, start, this.block_width, (this.height - 2) * this.block_height, color);
            }
        },
    
        // Draws the board and all fallen, not-yet-deleted blocks.
        drawSelf() {
            this.drawBackground();
            for (let y = 2; y < this.height; y++) {
                for (let x = 0; x < this.width; x++) {
                    if (this.hasBlock(x, y)) {
                        this.drawBlock(x, y, this.getColor(x,y));
                    }
                }
            }
        },
    
        // Draws the current tetromino (and its 'ghost').
        drawTetromino(playerPos, tetromino, rotationState, ghost) {
            if (ghost === undefined) {
                ghost = true;
            }

            /* "y = Math.max(0, 1 - playerPos.y)": Hack to NOT draw the part of the tetromino
            that is in the first 'invisible' row of the board, where it spawns. */
            for (let y = Math.max(0, 1 - playerPos.y); y < tetromino.dim; y++) {
                for (let x = 0; x < tetromino.dim; x++) {
                    if (tetromino.get(x, y, rotationState) === 1) {
                        if (playerPos.y + y === 1) {
                            this.drawHalfBlock(playerPos.x + x, playerPos.y + y, tetromino.color.rgb());
                        } else {
                            this.drawBlock(playerPos.x + x, playerPos.y + y, tetromino.color.rgb());
                        }                    
                    }
                }
            }  
            
            // 'ghost' is false only when drawing the next tetromino on the side of the board.
            if (ghost) {
                const shadowPos =  playerPos.copy();
                while (!this.doesItCollide(tetromino, shadowPos, rotationState)) {
                    shadowPos.y++;
                }
                shadowPos.y--;
    
                for (let y = Math.max(0, 2 - shadowPos.y); y < tetromino.dim; y++) {
                    for (let x = 0; x < tetromino.dim; x++) {
                        if (tetromino.get(x, y, rotationState) === 1) {
                            this.drawBlock(shadowPos.x + x, shadowPos.y + y, tetromino.color.rgba(0.2));
                        }
                    }
                }  
            }
        },
        
        /* 
        If the tetromino can't move any further, then it can be considered
        part of the board.
         */
        bakeTetrominoIntoBoard(playerPos, tetromino, rotationState) {
            for (let y = 0; y < tetromino.dim; y++) {
                for (let x = 0; x < tetromino.dim; x++) {
                    if (tetromino.get(x, y, rotationState) === 1) {
                        this.set(playerPos.x + x, playerPos.y + y, tetromino.color.rgb());
                    }
                }
            }
        },
    
        // Collision detection.
        doesItCollide(tetromino, playerPos, rotationState) {
            // Is it inside the left wall?
            if (playerPos.x < 0) {
                const partInsideLeftWall = -playerPos.x;
                for (let y = 0; y < tetromino.dim; y++) {
                    for (let x = 0; x < partInsideLeftWall; x++) {
                        if (tetromino.get(x, y, rotationState) === 1){
                            return true;
                        }
                    }
                }
            }
        
            // Is it inside the right wall?
            if (playerPos.x > this.width - tetromino.dim) {
                const partInsideRightWall = playerPos.x + tetromino.dim - this.width;
                for (let y = 0; y < tetromino.dim; y++) {
                    for (let x = tetromino.dim - 1; x > tetromino.dim - 1 - partInsideRightWall; x--) {
                        if (tetromino.get(x, y, rotationState) === 1){
                            return true;
                        }
                    }
                }
            }
        
            // Is it over the top? (needed when rotating at the spawn point)
            if (playerPos.y < 0) {
                const partOverTheTop = -playerPos.y;
                for (let y = 0; y < partOverTheTop; y++) {
                    for (let x = 0; x < tetromino.dim; x++) {
                        if (tetromino.get(x, y, rotationState) === 1){
                            return true;
                        }
                    }
                }
            }
        
            // Is it inside the ground?
            if (playerPos.y > this.height - tetromino.dim) {
                const partInsideGround = playerPos.y + tetromino.dim - this.height;
                for (let y = tetromino.dim - 1; y > tetromino.dim - 1 - partInsideGround; y--) {
                    for (let x = 0; x < tetromino.dim; x++) {
                        if (tetromino.get(x, y, rotationState) === 1){
                            return true;
                        }
                    }
                }
            }
        
            // Is it inside a block inside the board?
            const minDimX = Math.min(tetromino.dim, this.width - playerPos.x);
            const minDimY = Math.min(tetromino.dim, this.height - playerPos.y);
            for (let y = 0; y < minDimY; y++) {
                for (let x = 0; x < minDimX; x++) {
                    if (tetromino.get(x, y, rotationState) === 1 && this.hasBlock(playerPos.x + x, playerPos.y + y)){
                        return true;
                    }
                }
            }

            return false;
        },

        /* 
        The offsets in the wallkick data object are applied to the rotated tetromino 
        and then checked for collision.
        Should it collide with something, we move to the next test. 
        If all tests fail, the new rotation state is discarded and the tetromino won't rotate.
        The function returns true at the first test that doesn't collide and modifies the players position,
        else returns false and reverts any modifications to the player position. 
        */
        updatePositionOnRotate(playerPos, tetromino, oldRotationState, newRotationState) {
            /* Get the correct offsets by checking which tetromino is
            the current one. */
            let wallkick_offsets;
            if (tetromino.name === "i") {
                wallkick_offsets = this.wallkick_data[0];
            } else {
                wallkick_offsets = this.wallkick_data[1];
            }
        
            /* Test all possible offsets for collisions.
            Return false if none works. */
            let wallkick_offset;
            for (let i = 0; i < 5; i++) {
                wallkick_offset = wallkick_offsets[oldRotationState][newRotationState][i];
                playerPos.add(wallkick_offset);
                if (this.doesItCollide(tetromino, playerPos, newRotationState)) {
                    playerPos.sub(wallkick_offset);
                } else {
                    return true;
                }
            }
            return false;
        },
    
        // Is this actually necessary? I do animate it in the game loop...
        resetBoard() {
            for (let y = 0; y < this.height; y++) {
                for (let x = 0; x < this.width; x++) {
                    this.clearBlock(x,y);
                }
            }
        }
    };
}

/* 
Get next rotation state when the player rotates the piece.
I know it can be done more easily by just counting the number of
rotations instead of naming the states, but I will leave it deliberately verbose
to make it a little more readable and use this function to calculate it instead.
"0" -> original orientation or after rotating clockwise or counter-clockwise by 360 degrees from itself.
"R" -> orientation after rotating clockwise by 90 degrees or counter-clockwise by 270 degrees from the original one.
"2" -> orientation after rotating clockwise or counter-clockwise by 180 degrees from the original one.
"L" -> orientation after rotating clockwise by 270 degrees or counter-clockwise by 90 degrees from the original one.
 */
function nextRotationState(currentRotationState, rotationRight) {
    switch (currentRotationState) {
    case "0":
        if (rotationRight) {
            return "R";
        } else {
            return "L";
        }
    case "R":
        if (rotationRight) {
            return "2";
        } else {
            return "0";
        }
    case "2":
        if (rotationRight) {
            return "L";
        } else {
            return "R";
        }
    case "L":
        if (rotationRight) {
            return "0";
        } else {
            return "2";
        }
    default:
        console.log("nextRotationState: default case, unreachable.");
        return currentRotationState;
    }
}

/* 
Array containing the speeds per level, indexed by the level itself,
i.e. for Level 0, speed = 1.0000 and for Level 2, speed = 0.61780.
 */
const speeds = [1.00000, 0.79300, 0.61780, 0.47273, 
                0.35520, 0.26200, 0.18968, 0.13473, 
                0.09388, 0.06415, 0.04298, 0.02822, 0.01815];

// Tetromino factory function and definitions.
function createTetromino(name, arr, color, dim, startPos) {
    return {
        name: name,
        arr: arr,
        color: color,
        dim: dim,
        startPos: startPos,

        get(x, y, rotationState) {
            let newX, newY;
            switch (rotationState) {
            case "0":
                newX = x;
                newY = y;
                break;
            case "R":
                newX = y;
                newY = (this.dim - 1) - x;
                break;
            case "2":
                newX = (this.dim - 1) - x;
                newY = (this.dim - 1) - y;
                break;
            case "L":
                newX = (this.dim - 1) - y;
                newY = x;
                break;
            default:
                console.log("createTetromino.getIndex: unreachable code.");
            }
            return this.arr[newY * this.dim + newX];
        }
    };
}

/* 
Using this dummy instead of "undefined" for the initial value 
of the held tetromino, before the first hold. 
*/
const dummy_tetromino = createTetromino("dummy", 
                                    [], 
                                    createColor(0, 0, 0), 
                                    0,
                                    createVec2(0, 0));

const t_tetromino = createTetromino("t", 
                                    [0, 1, 0,
                                     1, 1, 1,
                                     0, 0, 0], 
                                    PURPLE, 
                                    3,
                                    createVec2(4, 0));

const j_tetromino = createTetromino("j", 
                                    [1, 0, 0,
                                     1, 1, 1,
                                     0, 0, 0], 
                                    BLUE, 
                                    3,
                                    createVec2(4, 0));

const el_tetromino = createTetromino("l", 
                                    [0, 0, 1,
                                     1, 1, 1,
                                     0, 0, 0], 
                                    ORANGE, 
                                    3,
                                    createVec2(4, 0));

const o_tetromino = createTetromino("o", 
                                    [1, 1,
                                     1, 1], 
                                    MAGENTA, 
                                    2,
                                    createVec2(4, 0));

const i_tetromino = createTetromino("i", 
                                    [0, 0, 0, 0,
                                     1, 1, 1, 1,
                                     0, 0, 0, 0,
                                     0, 0, 0, 0], 
                                    CYAN, 
                                    4,
                                    createVec2(3, 0));

const z_tetromino = createTetromino("z", 
                                    [1, 1, 0,
                                     0, 1, 1,
                                     0, 0, 0], 
                                    RED, 
                                    3,
                                    createVec2(4, 0));

const s_tetromino = createTetromino("s", 
                                    [0, 1, 1,
                                     1, 1, 0,
                                     0, 0, 0], 
                                    GREEN, 
                                    3,
                                    createVec2(4, 0));

const tetrominos = [t_tetromino, j_tetromino, el_tetromino, o_tetromino, i_tetromino, z_tetromino, s_tetromino];


/* 
Random number generator. 
The random numbers are the indices into the 'tetrominos' array:
0 -> t, 1 -> j, 2 -> el, 3 -> o, 4 -> i, 5 -> z, 6 -> s, 
Guarantees that:
    - in a 7-piece run *every tetromino will appear, at least once, at most twice*.
    - we always begin with a tetromino that isn't an 's' or a 'z'.
    - it makes 4 attempts to avoid:
        a) a tetromino twice in a row, i.e. at the border ('...|...') between current and next 7-piece run. 
        b) the sequences '...s|z...' or '...z|s...'.
    - if one of the attempt succeeds, we can still get something like '...sz|tzs...', i.e. the same pieces 
    or 'snake' sequences can appear at least 1 piece apart, but still only at the end of a sequence 
    and start of the next one. 
*/
function createRng() {
    return {
        bag: [],
        last: -1,

        next() {
            if (this.bag.length === 0) {
                this.fillBag();
            }
            let nextIndex = this.bag[0];
            this.bag = this.bag.slice(1);
            return nextIndex;
        },

        fillBag() {
            this.chooseFirst();
            
            let randomNumber;
            while (this.bag.length < 7) {
                randomNumber = Math.floor(Math.random() * 7);
                if (!this.bag.includes(randomNumber)) {
                    this.bag.push(randomNumber);
                }              
            }

            this.last = randomNumber;
            //console.log(this.bag);
        },

        chooseFirst() {
            let randomNumber = Math.floor(Math.random() * 7);
            if (this.last === -1) {              
                while (randomNumber > 4) {              
                    randomNumber = Math.floor(Math.random() * 7);
                } 
                this.bag.push(randomNumber);
            } else {
                let tries = 4;
                while (tries > 0 && (randomNumber === this.last || this.last + randomNumber === 11)) {
                    randomNumber = Math.floor(Math.random() * 7);      
                    tries--;    
                }
                this.bag.push(randomNumber);
            }
        }
    };
}

/* Wall-kick data (SRS) for 'board.updatePositionOnRotate'. 
Offsets to be applied to the rotated tetromino, each for 1 of 5 tests.
The i-piece has different offsets than all other pieces. */
const other_wallkick = {
    "0": {
        "R": [createVec2(0, 0), createVec2(-1, 0), createVec2(-1, -1), createVec2(0, 2), createVec2(-1, 2)],
        "L": [createVec2(0, 0), createVec2(1, 0), createVec2(1, -1), createVec2(0, 2), createVec2(1, 2)]
    },
    "R": {
        "2": [createVec2(0, 0), createVec2(1, 0), createVec2(1, 1), createVec2(0, -2), createVec2(1, -2)],
        "0": [createVec2(0, 0), createVec2(1, 0), createVec2(1, 1), createVec2(0, -2), createVec2(1, -2)]
    },
    "2": {
        "L": [createVec2(0, 0), createVec2(1, 0), createVec2(1, -1), createVec2(0, 2), createVec2(1, 2)],
        "R": [createVec2(0, 0), createVec2(-1, 0), createVec2(-1, -1), createVec2(0, 2), createVec2(-1, 2)],
    },
    "L": {
        "0": [createVec2(0, 0), createVec2(-1, 0), createVec2(-1, 1), createVec2(0, -2), createVec2(-1, -2)],
        "2": [createVec2(0, 0), createVec2(-1, 0), createVec2(-1, 1), createVec2(0, -2), createVec2(-1, -2)]
    }
};

const i_wallkick = {
    "0": {
        "R": [createVec2(0, 0), createVec2(-2, 0), createVec2(1, 0), createVec2(-2, 1), createVec2(1, -2)],
        "L": [createVec2(0, 0), createVec2(-1, 0), createVec2(2, 0), createVec2(-1, -2), createVec2(2, 1)]
    },
    "R": {
        "2": [createVec2(0, 0), createVec2(-1, 0), createVec2(2, 0), createVec2(-1, -2), createVec2(2, 1)],
        "0": [createVec2(0, 0), createVec2(2, 0), createVec2(-1, 0), createVec2(2, -1), createVec2(-1, 2)]
    },
    "2": {
        "L": [createVec2(0, 0), createVec2(2, 0), createVec2(-1, 0), createVec2(2, -1), createVec2(-1, 2)],
        "R": [createVec2(0, 0), createVec2(1, 0), createVec2(-2, 0), createVec2(1, 2), createVec2(-2, -1)]
    },
    "L": {
        "0": [createVec2(0, 0), createVec2(1, 0), createVec2(-2, 0), createVec2(1, 2), createVec2(-2, -1)],
        "2": [createVec2(0, 0), createVec2(-2, 0), createVec2(1, 0), createVec2(-2, 1), createVec2(1, -2)]
    }
};

// Game state.
const FALLING_STATE = 0;
const LINE_DELETION_STATE = 1;
const GAME_OVER_STATE = 2;


// Entry point.
(() => {
    // Get the canvas element and context.
    const canvas = document.getElementById('testbench');
    const ctx = canvas.getContext('2d');
    const width = 1200;
    const height = 900;

    canvas.width = width;
    canvas.height = height;

    // Tetris board dimensions.
    const board_width = 10;
    const board_height = 22; // 22 rows for the new ready pieces, 2 of them are hidden.
    const block_width = 40;
    const block_height = 40;
    const offset = createVec2(280, 35); // Offset into the canvas element.

    // Board initialization.
    let board = createBoard(ctx, board_width, board_height, block_width, block_height, offset, [i_wallkick, other_wallkick]);

    // Initial rotation state.
    let rotationState = "0"; 

    // Initial score and level.
    let score = 0;
    const scorePos = createVec2(2 * board.offset.x + board.width * (board.block_width + 1), board.offset.y + 3 * board.block_height);
    let level = 0;
    let numOfClearedLines = 0;

    // Choose initial and next tetromino randomly.
    const rng = createRng();
    let currentTetromino = tetrominos[rng.next()];
    let nextTetromino = tetrominos[rng.next()];
    let heldTetromino = dummy_tetromino;
    let holdLock = false;
    let requestNewPiece = false;

    // Initial player/piece position.
    let playerPos = currentTetromino.startPos.copy(); 

    // Program.
    let timer = 0;   
    let fallStep = speeds[0]; // Downwards movement every 'fallStep' seconds.
    let deleteStep = 0.05; // Delete a column from the to-be-deleted line every deleteStep seconds.
    let gameOverPeriod = 3 + 2 * deleteStep * Math.floor(board.width / 2);

    /* Draw State:
    FALLING_STATE: board + pieces falling
    LINE_DELETION_STATE: animate line deletion and update board.
    GAME_OVER_STATE: game-over stuff. */
    let drawState = FALLING_STATE;

    // Counter from delete lines, starting from the middle of the board.
    let deleteCounter = Math.floor(board.width / 2);

    // Array for lines to be deleted.
    let fullLinesY = new Array();

    // Variable to keep track of time.
    let start = -1;
    function draw(timestamp) {   
        // Calculate elapsed time from previous frame.
        // The framerate seems to be around 60 fps.
        if (start === -1) {
            start = timestamp;
        }

        // Elapsed time from previous frame in seconds.
        let dt = (timestamp - start) * 0.001;

        // Update the start variable.
        start = timestamp;  

        // Clear the canvas element.
        clearCanvasElement(ctx, width, height, 'rgba(255, 255, 224, 100)');
        
        // Draw state swicth statement.
        switch (drawState) {
        case FALLING_STATE: {
            // Draw board and player controlled tetromino.
            board.drawSelf();
            board.drawTetromino(playerPos, currentTetromino, rotationState);      
            
            // Draw next tetromino to the right of the board.
            board.drawTetromino(createVec2(11, 6), nextTetromino, "0", false); 
            board.drawText(12.5, 5.5, "Next piece", "Helvetica", 32, "center", "black");

            // Draw held tetromino to the left of the board.
            if (heldTetromino !== dummy_tetromino) {
                board.drawTetromino(createVec2(-5, 6), heldTetromino, "0", false); 
            }
            board.drawText(-3.5, 5.5, "HOLD", "Helvetica", 32, "center", "black");
            
            // Update timer and y-posision of player/falling piece and check if bottom has been reached.
            timer += dt;
            if (timer >= fallStep) {
                // After 'fallStep' seconds, move the piece automically downwards.
                playerPos.y++;

                // If bottom was reached, request a new piece and correct the y-position
                // of the player.
                if (board.doesItCollide(currentTetromino, playerPos, rotationState)) {                   
                    requestNewPiece = true;
                    playerPos.y--;
                }   

                // Reset timer.
                timer = 0;       
            }

            // If a new piece is requested.
            if (requestNewPiece) {            
                // Bake current tetromino into the board.
                // Use a temporary variable for the rotation state and use that
                // to bake the tetromino into the board to avoid the player from changing it
                // before that happens.
                const tempState = rotationState;
                board.bakeTetrominoIntoBoard(playerPos, currentTetromino, tempState);

                // Find if any lines have been filled.
                // If true, get their y-coordinates, update level, fallStep and score 
                // and change draw state to 1.
                fullLinesY = board.getFullLinesY();
                if (fullLinesY.length !== 0) {
                    numOfClearedLines += fullLinesY.length;

                    // Note: max possible cleared line per level: 12.
                    if (numOfClearedLines >= 10) {
                        numOfClearedLines = 0;
                        level++;
                    }

                    // Adjust fallStep/speed.
                    if (level < speeds.length) {
                        fallStep = speeds[level];
                    } else {
                        fallStep = speeds[speeds.length - 1];
                    }

                    // Update score.
                    switch(fullLinesY.length) {
                    case 1: {
                        score += 100 * (level + 1);
                    } break;
                    case 2: {
                        score += 300 * (level + 1);
                    } break;
                    case 3: {
                        score += 500 * (level + 1);
                    } break;
                    case 4: {
                        score += 800 * (level + 1);
                    } break;
                    default:
                    }

                    // Change draw state.
                    drawState = LINE_DELETION_STATE;
                }

                // Current piece <-> Next piece.
                currentTetromino = nextTetromino;   
                nextTetromino = tetrominos[rng.next()];          

                // Reset player position and rotation state.
                playerPos = currentTetromino.startPos.copy();
                rotationState = "0";
                requestNewPiece = false;

                // Check for game over (let it delete line without immediately giving a game-over, if somehow filled).
                playerPos.y++;
                if (board.doesItCollide(currentTetromino, playerPos, rotationState) && fullLinesY.length === 0) {
                    drawState = GAME_OVER_STATE;
                    timer = 0;
                } 
                playerPos.y--;

                holdLock = false;
            }
        } break;
        case LINE_DELETION_STATE: {          
            // Animate line deletion by clearing every column,
            // but only in the full lines.
            // starting from the middle and going to the sides.
            timer += dt;
            if (timer >= deleteStep) {
                for (let y of fullLinesY) {
                    board.clearBlock(deleteCounter - 1, y);
                    board.clearBlock(board.width - deleteCounter, y);                  
                }
                deleteCounter--;
                timer = 0;
            }

            // Draw board.
            board.drawSelf();

            // After animating the deletion of the lines, update the state of the board,
            // reset timer, set draw state to FALLING_STATE and reset the column counter.
            if (deleteCounter === 0) {
                board.deleteLines(fullLinesY);
                timer = 0;
                drawState = FALLING_STATE;
                deleteCounter = Math.floor(board.width / 2);
            }
        } break;
        case GAME_OVER_STATE: {
            // Animate resetting board by clearing every column,
            // starting from the middle and going to the sides.
            timer += dt;
            if (timer >= 2 * deleteStep && deleteCounter !== 0) {
                for (let y = 0; y < board.height; y++) {
                    board.clearBlock(deleteCounter - 1, y);
                    board.clearBlock(board.width - deleteCounter, y);                  
                }
                deleteCounter--;
                timer = 0;
            }

            board.drawSelf();

            // Draw a game over text in the middle of the board.
            board.drawText(board.width / 2, board.height / 2, "GAME OVER", "Helvetica", 32, "center", "black");
            
            if (timer > gameOverPeriod) {
                score = 0;
                drawState = FALLING_STATE;
                timer = 0;
                level = 0;
                numOfClearedLines = 0;
                fallStep = speeds[0];
                deleteCounter = Math.floor(board.width / 2);
                heldTetromino = dummy_tetromino;
                holdLock = false;           
            }
        } break;
        default: {
            // Should be unreachale.
            console.log("Main game loop switch. Unreachable.");
            drawState = FALLING_STATE;
        }
        }

        // Draw score (TODO: all statistics).
        drawText(ctx, `Score: ${score}`, scorePos, "Helvetica", 32, "left", "black");

        // Request another frame.
        window.requestAnimationFrame(draw);
    }

    window.requestAnimationFrame(draw);

    // Add event listener for controls.
    document.addEventListener('keydown', event => {
        // Don't allow controls outside of drawState = FALLING_STATE or when requesting a new tetromino.
        if (drawState === FALLING_STATE && !requestNewPiece) {
            // On pressing J, rotate right. 
            if (event.code === 'ArrowRight') {          
                // Get next rotation state.
                const newRotationState = nextRotationState(rotationState, true); 

                // Only update the rotation state if the newly rotated tetromino
                // doesn't collide with its surroundings.
                if (board.updatePositionOnRotate(playerPos, currentTetromino, rotationState, newRotationState)) {
                    rotationState = newRotationState;           
                }           
            }

            // On pressing H, rotate left.
            if (event.code === 'ArrowLeft') {   
                // Get next rotation state.
                const newRotationState = nextRotationState(rotationState, false);   

                // Only update the rotation state if the newly rotated tetromino
                // doesn't collide with its surroundings.
                if (board.updatePositionOnRotate(playerPos, currentTetromino, rotationState, newRotationState)) {
                    rotationState = newRotationState;           
                }          
            }

            // On pressing A, move left.
            if (event.code === 'KeyA') {
                playerPos.x--;

                // Revert to original position if the tetromino collides with its surroundings.
                if (board.doesItCollide(currentTetromino, playerPos, rotationState)) {
                    playerPos.x++;
                }                    
            }

            // On pressing D, move left.
            if (event.code === 'KeyD') {
                playerPos.x++;

                // Revert to original position if the tetromino collides with its surroundings.
                if (board.doesItCollide(currentTetromino, playerPos, rotationState)) {
                    playerPos.x--;
                }           
            }

            // On pressing S, move left.
            if (event.code === 'KeyS') {
                playerPos.y++;
                score++;

                // Revert to original position if the tetromino collides with its surroundings.
                if (board.doesItCollide(currentTetromino, playerPos, rotationState)) {
                    playerPos.y--;
                    score--;
                }          
            }

            // On pressing K, hold piece.
            if (event.code === 'KeyF' && !holdLock) {
                let temp = heldTetromino;
                heldTetromino = currentTetromino;

                // After the initial hold, only ever allow swapping the held and current tetromino, 
                // if the held tetromino fits at the inital position and rotation state 
                // (i.e. when game over is unavoidable).
                if (temp === dummy_tetromino) {
                    // Initial hold case.
                    currentTetromino = nextTetromino;   
                    nextTetromino = tetrominos[rng.next()]; 
                    rotationState = "0";  
                    playerPos = currentTetromino.startPos.copy(); 
                    timer = 0;  
                    holdLock = true;     
                } else if (!board.doesItCollide(temp, temp.startPos.copy(), "0")) {
                    // Swap held and current tetrominos.
                    currentTetromino = temp;  
                    rotationState = "0";  
                    playerPos = currentTetromino.startPos.copy(); 
                    timer = 0;  
                    holdLock = true;         
                } else {
                    // Don't swap, if held tetromino doesn't fit.
                    heldTetromino = temp;
                }                
            }

            // On pressing W, harddrop.
            if (event.code === 'KeyW') {
                // Keep moving downwards until the piece collides with a block.
                do {
                    playerPos.y++;
                    score += 2;
                } while (!board.doesItCollide(currentTetromino, playerPos, rotationState));
                playerPos.y--;
                score -= 2;

                // Harddropping means the piece should be locked in its place.
                // Request a new piece and restart timer.
                requestNewPiece = true;
                timer = 0; 
            }
        }     
    });
})();
