///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//   Data Structures - Definitions
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// function Logic() {
//     this.links = {};
//     this.blocks = {};
// }
////////////////////////////////////////////////////////////////////////////////

// TODO: initialize simply by passing in the total width, total height, and ratio of w/h for block and margins
// the grid is the overall data structure for managing block locations and calculating routes between them
function Grid(blockColWidth, blockRowHeight, marginColWidth, marginRowHeight) {
    this.size = 7; // number of rows and columns
    this.blockColWidth = blockColWidth; // width of cells in columns with blocks
    this.blockRowHeight = blockRowHeight; // height of cells in columns with blocks
    this.marginColWidth = marginColWidth; // width of cells in columns without blocks (the margins)
    this.marginRowHeight = marginRowHeight; // height of cells in rows without blocks (the margins)

    this.cells = []; // array of [Cell] objects

    // initialize list of cells using the size of the grid
    for (var row = 0; row < this.size; row++) {
        for (var col = 0; col < this.size; col++) {
            var cellLocation = new CellLocation(col, row);
            var cell = new Cell(cellLocation);
            this.cells.push(cell);
        }
    }
}

// the cell has a location in the grid, possibly an associated Block object
//  and DOM element, and a list of which routes pass through the cell
function Cell(location) {
    this.location = location; // CellLocation
    this.routeTrackers = []; // [RouteTracker]
    // this.block = null;
    this.domElement = null; // <IMG> element //TODO: remove DOM element to decouple frontend from backend
}

function CellLocation(col,row) {
    this.col = col;
    this.row = row;
    this.offsetX = 0;
    this.offsetY = 0;
}

// the route contains the corner points and the list of all cells it passes through
function Route(initialCellLocations) {
    this.cellLocations = []; // [CellLocation]
    this.allCells = []; // [Cell]

    if (initialCellLocations !== undefined) {
        var that = this;
        initialCellLocations.forEach( function(location) {
            that.addLocation(location.col,location.row);
        });
    }
    this.pointData = null; // list of [{screenX, screenY}]
}

// TODO: poorly named / designed
// contains useful data for keeping track of how a route passes through a cell
function RouteTracker(route, params) {
    this.route = route;
    this.containsVertical = params["vertical"]; // todo: convert all dictionaries to {vertical: vertical} instead of {"vertical":vertical} syntax
    this.containsHorizontal = params["horizontal"];
    // todo: add this.isStart and this.isEnd
    this.isStart = false;
    this.isEnd = false;
}

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//   Data Structures - Methods
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/////////////////////////////
//  CELL LOCATION METHODS  //
/////////////////////////////

// *** Public (to app?)
// gets the center x coordinate of this cell row/column location
// varies depending on whether this is in a block row or margin row
CellLocation.prototype.getCenterX = function(blockColWidth, marginColWidth) {
    var leftEdgeX = 0;
    if (this.col % 2 === 0) { // this is a block cell
        leftEdgeX = (this.col / 2) * (blockColWidth + marginColWidth);
        return leftEdgeX + blockColWidth/2;

    } else { // this is a margin cell
        leftEdgeX = Math.ceil(this.col / 2) * blockColWidth + Math.floor(this.col / 2) * marginColWidth;
        return leftEdgeX + marginColWidth/2;
    }
};

// *** Public (to app?)
// gets the center y coordinate of this cell row/column location
// varies depending on whether this is in a block row or margin row
CellLocation.prototype.getCenterY = function(blockRowHeight, marginRowHeight) {
    var topEdgeY = 0;
    if (this.row % 2 === 0) { // this is a block cell
        topEdgeY = (this.row / 2) * (blockRowHeight + marginRowHeight);
        return topEdgeY + blockRowHeight/2;

    } else { // this is a margin cell
        topEdgeY = Math.ceil(this.row / 2) * blockRowHeight + Math.floor(this.row / 2) * marginRowHeight;
        return topEdgeY + marginRowHeight/2;
    }
};

////////////////////
//  CELL METHODS  //
////////////////////

// *** Public to app
Cell.prototype.canHaveBlock = function() {
    return (this.location.col % 2 === 0) && (this.location.row % 2 === 0);
}

// *** Public to app
// utility - gets the hue for cells in a given column
Cell.prototype.getColorHSL = function() {
    var blockColumn = Math.floor(this.location.col / 2);
    var colorMap = { blue: {h: 180, s:100, l:60}, green: {h: 122, s:100, l:60}, yellow: {h: 59, s:100, l:60}, red: {h:333, s:100, l:60} };
    var colorName = ['blue','green','yellow','red'][blockColumn];
    return colorMap[colorName];
};

// *** Public
// utility - counts the number of horizontal routes in a cell
Cell.prototype.countHorizontalRoutes = function() {
    return this.routeTrackers.filter(function(value) { return value.containsHorizontal; }).length;
};

// *** Public
// utility - counts the number of vertical routes in a cell
// optionally excludes start or endpoints so that routes starting in a
// block cell don't count as overlapping routes ending in a block cell
Cell.prototype.countVerticalRoutes = function(excludeStartPoints, excludeEndPoints) {
    return this.routeTrackers.filter(function(value) {
        return value.containsVertical && !((value.isStart && excludeStartPoints) || (value.isEnd && excludeEndPoints));
    }).length;
};

// *** Public
// utility - checks whether the cell has a vertical route tracker for the given route
Cell.prototype.containsVerticalSegmentOfRoute = function(route) {
    var containsVerticalSegment = false;
    this.routeTrackers.forEach( function(routeTracker) {
        if (routeTracker.route === route && routeTracker.containsVertical) {
            containsVerticalSegment = true;
        }
    });
    return containsVerticalSegment;
};

// *** Public
// utility - checks whether the cell has a horizontal route tracker for the given route
Cell.prototype.containsHorizontalSegmentOfRoute = function(route) {
    var containsHorizontalSegment = false;
    this.routeTrackers.forEach( function(routeTracker) {
        if (routeTracker.route === route && routeTracker.containsHorizontal) {
            containsHorizontalSegment = true;
        }
    });
    return containsHorizontalSegment;
};

Cell.prototype.blockAtThisLocation = function() {
    if (!this.canHaveBlock()) return null;
    var blockPos = convertGridPosToBlockPos(this.location.col, this.location.row);
    return getBlockXY(blockPos.x, blockPos.y);
}

Cell.prototype.blockOverlappingThisMargin = function() {
    if (this.location.col % 2 === 0 || this.location.row % 2 === 1) return; // this isn't a margin cell
    var blockPosBefore = convertGridPosToBlockPos(this.location.col-1, this.location.row);
    var blockPosAfter = convertGridPosToBlockPos(this.location.col+1, this.location.row);
    var blockBefore = getBlockXY(blockPosBefore.x, blockPosBefore.y);
    var blockAfter = getBlockXY(blockPosAfter.x, blockPosAfter.y);
    if (blockBefore === blockAfter) {
        return blockBefore;
    } else {
        return null;
    }
}

Cell.prototype.itemAtThisLocation = function() {
    var block = this.blockAtThisLocation();
    var blockGridPos = convertBlockPosToGridPos(block.x, block.y);
    var itemCol = this.location.col - blockGridPos.col;
    return convertGridPosToBlockPos(itemCol, blockGridPos.row).x;
}

Cell.prototype.isFirstItem = function() {
    return this.itemAtThisLocation() === 0;
}

Cell.prototype.isLastItem = function() {
    var block = this.blockAtThisLocation();
    var item = this.itemAtThisLocation();
    return item === (block.blockSize-1);
}

Cell.prototype.isMarginCell = function() {
    return this.location.row % 2 === 0 && this.location.col % 2 === 1;
}

/////////////////////
//  ROUTE METHODS  //
/////////////////////

// *** Public
// adds a new corner location to a route
Route.prototype.addLocation = function(col, row) {
    var skip = false;
    this.cellLocations.forEach(function(cellLocation) {
        if (cellLocation.col === col && cellLocation.row === row) { // implicitly prevent duplicate points from being added
            skip = true;
        }
    });
    if (!skip) {
        this.cellLocations.push(new CellLocation(col, row));
    }
};

// *** Public
// utility - outputs how far a route travels left/right and up/down, for
// use in choosing the order of routes so that they usually don't cross
Route.prototype.getOrderPreferences = function() {
    var lastCell = this.cellLocations[this.cellLocations.length-1];
    var firstCell = this.cellLocations[0];
    return {
        horizontal: lastCell.col - firstCell.col,
        vertical: lastCell.row - firstCell.row
    };
};

// *** Public ?
// points is an array like [{screenX: x1, screenY: y1}, ...]
// calculates useful pointData for drawing lines with varying color/weight/etc,
// by determining how far along the line each corner is located (as a percentage)


// *** Public to app
Route.prototype.getXYPositionAtPercentage = function(percent) {
    var pointData = this.pointData;
    if (percent >= 0 && percent <= 1) {
        var indexBefore = 0;
        for (var i = 1; i < pointData.points.length; i++) {
            var nextPercent = pointData.percentages[i];
            if (nextPercent > percent) {
                indexBefore = i-1;
                break;
            }
        }

        var x1 = pointData.points[indexBefore].screenX;
        var y1 = pointData.points[indexBefore].screenY;
        var x2 = pointData.points[indexBefore+1].screenX;
        var y2 = pointData.points[indexBefore+1].screenY;

        var percentOver = percent - pointData.percentages[indexBefore];
        var alpha = percentOver / (pointData.percentages[indexBefore+1] - pointData.percentages[indexBefore]);
        var x = (1 - alpha) * x1 + alpha * x2;
        var y = (1 - alpha) * y1 + alpha * y2;

        return {
            screenX: x,
            screenY: y
        };

    } else {
        return null;
    }
}

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//   GRID METHODS
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


function addBlockLink(blockA, blockB, itemA, itemB) {
    if (blockA && blockB) {
        var blockLink = new BlockLink();
        blockLink.blockA = blockA;
        blockLink.blockB = blockB;
        blockLink.itemA = itemA;
        blockLink.itemB = itemB;
        blockLinkKey = "blockLink" + uuidTime();
        if (!doesLinkAlreadyExist(blockLink)) {
            globalStates.currentLogic.links[blockLinkKey] = blockLink;
            return blockLink;
        }
    }
    return null;
}

function setTempLink(newTempLink) {
    if (!doesLinkAlreadyExist(newTempLink)) {
        globalStates.currentLogic.tempLink = newTempLink;
    }
}

function removeBlockLink(blockLinkKey) {
    delete globalStates.currentLogic.links[blockLinkKey];
}

function clearAllBlockLinks() {
    for (var blockLinkKey in globalStates.currentLogic.blocks) {
        removeBlockLink(blockLinkKey);
    }
    globalStates.currentLogic.tempLink = null;
}

function removeBlock(logic, block) {
    removeLinksForBlock(logic, block);
    for (var blockKey in logic.blocks) {
        if (logic.blocks[blockKey] === block) {
            delete logic.blocks[blockKey];
        }
    }
}

function removeLinksForBlock(logic, block) {
    for (var linkKey in logic.links) {
        var link = logic.links[linkKey];
        if (link.blockA === block || link.blockB === block) {
            delete logic.links[linkKey];
        }
    }
}

function doesLinkAlreadyExist(blockLink) {
    for (var blockLinkKey in globalStates.currentLogic.links) {
        var thatBlockLink = globalStates.currentLogic.links[blockLinkKey];
        if (areBlockLinksEqual(blockLink, thatBlockLink)) {
            return true;
        }
    }
    return false;
}

function areBlockLinksEqual(blockLink1, blockLink2) {
    if (blockLink1.blockA === blockLink2.blockA && blockLink1.itemA === blockLink2.itemA) {
        if (blockLink1.blockB === blockLink2.blockB && blockLink1.itemB === blockLink2.itemB) {
            return true;
        }
    }
    return false;
}


function preprocessPointsForDrawing(points) { //putting it in here makes it private... only ever used here.. could just inline it
    // adds up the total length the route points travel
    var lengths = []; // size = lines.length-1
    for (var i = 1; i < points.length; i++) {
        var dx = points[i].screenX - points[i-1].screenX;
        var dy = points[i].screenY - points[i-1].screenY;
        lengths.push(Math.sqrt(dx * dx + dy * dy));
    }
    var totalLength = lengths.reduce(function(a,b){return a + b;}, 0);
    // calculates the percentage along the path of each point
    var prevPercent = 0.0;
    var percentages = [prevPercent];
    percentages.push.apply(percentages, lengths.map(function(length){ prevPercent += length/totalLength; return prevPercent; }));

    // TODO: we could just return this data here and assign it to this.point data in another function...
    return {
        points: points,
        totalLength: totalLength,
        lengths: lengths,
        percentages: percentages
    };
};

////////////////////////////////////////////////////////////////////////////////
//      GRID UTILITIES     
////////////////////////////////////////////////////////////////////////////////

// *** Public to app
// utility - returns the x,y coordinates of corners for a link so that they can be rendered
// (includes the offsets - these are the actual points to draw on the screen exactly as is)
Grid.prototype.getPointsForLink = function(blockLink) {
    var points = [];
    if (blockLink.route !== null) {
        var that = this;
        blockLink.route.cellLocations.forEach( function(location) {
            var screenX = that.getColumnCenterX(location.col) + location.offsetX;
            var screenY = that.getRowCenterY(location.row) + location.offsetY;
            points.push({
                "screenX": screenX,
                "screenY": screenY
            });
        });

    }
    return points;
};

// *** Public to app   // TODO: is this still used?
// utility - calculates the total width and height of the grid using the sizes of the cells
Grid.prototype.getPixelDimensions = function() {
    var width = Math.ceil(this.size/2) * this.blockColWidth +  Math.floor(this.size/2) * this.marginColWidth;
    var height = Math.ceil(this.size/2) * this.blockRowHeight +  Math.floor(this.size/2) * this.marginRowHeight;
    return {
        "width": width,
        "height": height
    };
}

// utility - gets a cell at a given grid location
Grid.prototype.getCell = function(col, row) {
    if (row >= 0 && row < this.size && col >= 0 && col < this.size) {
        return this.cells[row * this.size + col];
    }
};

// utility - gets width of cell, which differs for cols with blocks vs margins
Grid.prototype.getCellWidth = function(col) {
    return (col % 2 === 0) ? this.blockColWidth : this.marginColWidth;
};

// utility - gets height of cell, which differs for rows with blocks vs margins
Grid.prototype.getCellHeight = function(row) {
    return (row % 2 === 0) ? this.blockRowHeight : this.marginRowHeight;
};

// utility - gets x position of cell
Grid.prototype.getCellCenterX = function(cell) {
    return cell.location.getCenterX(this.blockColWidth, this.marginColWidth);
};

// utility - gets y position of cell
Grid.prototype.getCellCenterY = function(cell) {
    return cell.location.getCenterY(this.blockRowHeight, this.marginRowHeight);
};

// utility - gets x position for a column 
Grid.prototype.getColumnCenterX = function(col) {
    return this.getCellCenterX(this.getCell(col,0));
};

// utility - gets y position for a row
Grid.prototype.getRowCenterY = function(row) {
    return this.getCellCenterY(this.getCell(0,row));
};

Grid.prototype.forEachLink = function(action) { // TODO: this doesn't need to be in Grid anymore
    for (var blockLinkKey in globalStates.currentLogic.links) {
        action(globalStates.currentLogic.links[blockLinkKey]);
    }
    if (globalStates.currentLogic.tempLink) {
        action(globalStates.currentLogic.tempLink);
    }
}

Grid.prototype.allLinks = function(action) { // TODO: change this after figuring out where tempLink goes
    var linksArray = [];
    this.forEachLink(function(link) {
        linksArray.push(link);
    });
    return linksArray;
}

// performs action on all cells that can have a block (not the empty margins)
Grid.prototype.forEachPossibleBlockCell = function(action) {
    this.cells.filter( function(cell) {
        return cell.canHaveBlock();
    }).forEach( function(cell) {
        action(cell);
    });
};

Grid.prototype.forEachPossibleBlockMarginCell = function(action) {
    this.cells.filter( function(cell) {
        return (cell.location.row % 2 === 0 && cell.location.col % 2 === 1);
    }).forEach( function(cell) {
        action(cell);
    });
}

// utility - true iff cells are in same row
Grid.prototype.areCellsHorizontal = function(cell1, cell2) {
    if (cell1 && cell2) {
        return cell1.location.row === cell2.location.row;
    }
    return false;
};

// utility - true iff cells are in same column
Grid.prototype.areCellsVertical = function(cell1, cell2) {
    if (cell1 && cell2) {
        return cell1.location.col === cell2.location.col;
    }
    return false;
};

// utility - if cells are in a line horizontally or vertically, returns all the cells in between them
Grid.prototype.getCellsBetween = function(cell1, cell2) {
    var cellsBetween = [];
    if (this.areCellsHorizontal(cell1, cell2)) {
        var minCol = Math.min(cell1.location.col, cell2.location.col);
        var maxCol = Math.max(cell1.location.col, cell2.location.col);
        cellsBetween.push.apply(cellsBetween, this.cells.filter( function(cell) {
            return cell.location.row === cell1.location.row && cell.location.col > minCol && cell.location.col < maxCol;
        }));

    } else if (this.areCellsVertical(cell1, cell2)) {
        var minRow = Math.min(cell1.location.row, cell2.location.row);
        var maxRow = Math.max(cell1.location.row, cell2.location.row);
        cellsBetween.push.apply(cellsBetween, this.cells.filter( function(cell) {
            return cell.location.col === cell1.location.col && cell.location.row > minRow && cell.location.row < maxRow;
        }));
    }
    return cellsBetween;
};

// utility - true iff a cell between the start and end actually contains a block
Grid.prototype.areBlocksBetween = function(startCell, endCell) {
    var blocksBetween = this.getCellsBetween(startCell, endCell).filter( function(cell) {
        return cell.blockAtThisLocation() !== null;
    });
    return blocksBetween.length > 0;
};

// utility - looks vertically below a location until it finds a block, or null if none in that column
Grid.prototype.getFirstBlockBelow = function(col, row) {
    for (var r = row+1; r < this.size; r++) {
        var cell = this.getCell(col,r);
        if (cell.blockAtThisLocation() !== null) {
            return cell.blockAtThisLocation();
        }
    }
    return null;
};

// resets the number of "horizontal" or "vertical" segments contained to 0 for all cells
Grid.prototype.resetCellRouteCounts = function() {
    this.cells.forEach(function(cell) {
        cell.routeTrackers = [];
    });
};

// utility - for a given cell in a route, looks at the previous and next cells in the route to
// figure out if the cell contains a vertical path, horizontal path, or both (it's a corner)
Grid.prototype.getLineSegmentDirections = function(prevCell,currentCell,nextCell) {
    var containsHorizontal = false;
    var containsVertical = false;
    if (this.areCellsHorizontal(currentCell, prevCell) ||
        this.areCellsHorizontal(currentCell, nextCell)) {
        containsHorizontal = true;
    }

    if (this.areCellsVertical(currentCell, prevCell) ||
        this.areCellsVertical(currentCell, nextCell)) {
        containsVertical = true;
    }
    return {
        "horizontal": containsHorizontal,
        "vertical": containsVertical
    };
};

////////////////////////////////////////////////////////////////////////////////
//      GRID ROUTING ALGORITHM      
////////////////////////////////////////////////////////////////////////////////


// *** main method for routing ***
// first, calculates the routes (which cells they go thru)
// next, offsets each so that they don't visually overlap
// lastly, prepares points so that they can be easily rendered
Grid.prototype.recalculateAllRoutes = function() {
    var that = this;

    that.resetCellRouteCounts(); // step 1 works

    that.forEachLink( function(link) {
        that.calculateLinkRoute(link);  // step 2 works
    });
    var overlaps = that.determineMaxOverlaps();
//////////// ^ yes
    that.calculateOffsets(overlaps);

    that.forEachLink( function(link) {
        var points = that.getPointsForLink(link);
        link.route.pointData = preprocessPointsForDrawing(points);
    });
};

// given a link, calculates all the corner points between the start block and end block,
// and sets the route of the link to contain the corner points and all the cells between
Grid.prototype.calculateLinkRoute = function(link) {
    //TODO: need to account for itemA, itemB in this algorithm
    var startLocation = convertBlockPosToGridPos(link.blockA.x + link.itemA, link.blockA.y); //link.startBlock.cell.location;
    var endLocation = convertBlockPosToGridPos(link.blockB.x + link.itemB, link.blockB.y); //link.endBlock.cell.location;
    var route = new Route([startLocation]);

    // by default lines loop around the right of blocks, except for last column or if destination is to left of start
    var sideToApproachOn = 1; // to the right
    if (endLocation.col < startLocation.col || startLocation.col === 6) {
        sideToApproachOn = -1; // to the left
    }

    if (startLocation.row < endLocation.row) {
        // simplifies edge case when block is directly below by skipping rest of points
        var areBlocksBetweenInStartColumn = this.areBlocksBetween(this.getCell(startLocation.col, startLocation.row), this.getCell(startLocation.col, endLocation.row));// new CellLocation(startLocation.col, endLocation.row));

        if (startLocation.col !== endLocation.col || areBlocksBetweenInStartColumn) {

            // first point continues down vertically as far as it can go without hitting another block
            var firstBlockBelow = this.getFirstBlockBelow(startLocation.col, startLocation.row);
            var rowToDrawDownTo = endLocation.row-1;
            if (firstBlockBelow !== null) {
                var firstBlockRowBelow = convertBlockPosToGridPos(firstBlockBelow.x, firstBlockBelow.y).row;
                rowToDrawDownTo = Math.min(firstBlockRowBelow-1, rowToDrawDownTo); //Math.min(firstBlockBelow.cell.location.row-1, rowToDrawDownTo);
            }
            route.addLocation(startLocation.col, rowToDrawDownTo);

            if (rowToDrawDownTo < endLocation.row-1) {
                // second point goes horizontally to the side of the start column
                route.addLocation(startLocation.col+sideToApproachOn, rowToDrawDownTo);
                // fourth point goes vertically to the side of the end column
                route.addLocation(startLocation.col+sideToApproachOn, endLocation.row-1);
            }

            // fifth point goes horizontally until it is directly above center of end block
            route.addLocation(endLocation.col, endLocation.row-1);
        }

    } else {

        if (startLocation.row < this.size-1) { // first point is vertically below the start, except for bottom row
            route.addLocation(startLocation.col, startLocation.row+1);
            route.addLocation(startLocation.col + sideToApproachOn, startLocation.row+1);
        } else { // start from side of bottom row
            route.addLocation(startLocation.col + sideToApproachOn, startLocation.row);
        }

        // different things happen if destination is top row or not...
        if (endLocation.row > 0) {
            // if not top row, next point is above and to the side of the destination
            route.addLocation(startLocation.col + sideToApproachOn, endLocation.row-1);
            // last point is directly vertically above the end block
            route.addLocation(endLocation.col, endLocation.row-1);

        } else { // if it's going to the top row, approach from the side rather than above it

            // if there's nothing blocking the line from getting to the side of the end block, last point goes there
            var cellsBetween = this.getCellsBetween(this.getCell(startLocation.col, 0), this.getCell(endLocation.col, endLocation.row)); //new CellLocation(startLocation.col,0), endLocation);
            var blocksBetween = cellsBetween.filter(function(cell){
                return cell.blockAtThisLocation() !== null;
                // return cell.block !== null;
            });
            if (blocksBetween.length === 0) {
                route.addLocation(startLocation.col + sideToApproachOn, 0);

            } else { // final exception! if there are blocks horizontally between start and end in top row, go under and up
                // first extra point stops below top row in the column next to the start block, creating a vertical line
                route.addLocation(startLocation.col + sideToApproachOn, 1);
                // next extra point goes horizontally over to the column of the last block
                route.addLocation(endLocation.col - sideToApproachOn, 1);
                // final extra point goes vertically up to the direct side of the end block
                route.addLocation(endLocation.col - sideToApproachOn, 0);
            }
        }
    }

    route.addLocation(endLocation.col, endLocation.row);
    route.allCells = this.calculateAllCellsContainingRoute(route);
    link.route = route;
};

// Given the corner points for a route, finds all the cells in between, and labels each with
// "horizontal", "vertical", or both depending on which way the route goes thru that cell
Grid.prototype.calculateAllCellsContainingRoute = function(route) {
    var allCells = [];
    for (var i=0; i < route.cellLocations.length; i++) {

        var prevCell = null;
        var currentCell = null;
        var nextCell = null;

        currentCell = this.getCell(route.cellLocations[i].col, route.cellLocations[i].row);
        if (i > 0) {
            prevCell = this.getCell(route.cellLocations[i-1].col, route.cellLocations[i-1].row);
        }
        if (i < route.cellLocations.length-1) {
            nextCell = this.getCell(route.cellLocations[i+1].col, route.cellLocations[i+1].row);
        }
        var segmentDirections = this.getLineSegmentDirections(prevCell, currentCell, nextCell);

        var routeTracker = new RouteTracker(route, segmentDirections); // corners have both vertical and horizontal. end point has only vertical //todo: except for top/bottom row
        if (prevCell === null) {
            routeTracker.isStart = true;
        }
        if (nextCell === null) {
            routeTracker.isEnd = true;
        }
        currentCell.routeTrackers.push(routeTracker);
        allCells.push(currentCell); // add endpoint cell for each segment

        var cellsBetween = this.getCellsBetween(currentCell, nextCell);
        var areNextHorizontal = this.areCellsHorizontal(currentCell, nextCell);
        var areNextVertical = !areNextHorizontal; // mutually exclusive
        cellsBetween.forEach( function(cell) {
            var routeTracker = new RouteTracker(route, {"horizontal": areNextHorizontal, "vertical": areNextVertical});
            cell.routeTrackers.push(routeTracker);
        });
        allCells.push.apply(allCells, cellsBetween);
    }
    return allCells;
};

// counts how many routes overlap eachother in each row and column, and sorts them, so that
// they can be displaced around the center of the row/column and not overlap one another
Grid.prototype.determineMaxOverlaps = function() {
    var colRouteOverlaps = [];
    var horizontallySortedLinks;
    for (var c = 0; c < this.size; c++) {
        var thisColRouteOverlaps = [];
        // for each route in column
        var that = this;

        // decreases future overlaps of links in the grid by sorting them left/right
        // so that links going to the left don't need to cross over links going to the right
        horizontallySortedLinks = that.allLinks().sort(function(link1, link2){
            var p1 = link1.route.getOrderPreferences();
            var p2 = link2.route.getOrderPreferences();
            var horizontalOrder = p1.horizontal - p2.horizontal;
            var verticalOrder = p1.vertical - p2.vertical;

            var startCellLocation1 = convertBlockPosToGridPos(link1.blockA.x, link1.blockA.y);
            var endCellLocation1 = convertBlockPosToGridPos(link1.blockB.x, link1.blockB.y);

            var startCellLocation2 = convertBlockPosToGridPos(link2.blockA.x, link2.blockA.y);
            var endCellLocation2 = convertBlockPosToGridPos(link2.blockB.x, link2.blockB.y);

            // special case if link stays in same column as the start block
            var dCol1 = endCellLocation1.col - startCellLocation1.col;
            var dCol2 = endCellLocation2.col - startCellLocation2.col;

            if (p1.vertical >= 0 && p2.vertical >= 0) {
                if (dCol1 === 0 && dCol2 === 0) { // in start col, bottom -> last
                    return verticalOrder;
                }
                if (dCol1 === 0 && dCol2 !== 0) { // lines to right of start col -> last, those to left -> first
                    return -1 * dCol2;
                }
                if (dCol1 > 0 && dCol2 > 0) { // to right of start col, topright diagonal bands -> last
                    var diagonalOrder = horizontalOrder - verticalOrder;
                    if (diagonalOrder === 0) { // within same diagonal band, top -> last
                        return -1 * verticalOrder;
                    } else {
                        return diagonalOrder;
                    }
                }
                if (dCol1 < 0 && dCol2 < 0) { // to left of start col, bottomright diagonal bands -> last
                    var diagonalOrder = horizontalOrder + verticalOrder;
                    if (diagonalOrder === 0) { // within same diagonal band, bottom -> last
                        return verticalOrder;
                    } else {
                        return diagonalOrder;
                    }
                }
            }

            // by default, if it doesn't fit into one of those special cases, just sort by horizontal distance
            return horizontalOrder;
            //return 10 * (p1.horizontal - p2.horizontal) + 1 * (Math.abs(p2.vertical) - Math.abs(p1.vertical));
        });

        horizontallySortedLinks.forEach( function(link) {
            // filter a list of cells containing that route and that column
            var routeCellsInThisCol = link.route.allCells.filter(function(cell){return cell.location.col === c;});
            if (routeCellsInThisCol.length > 0) { // does this route contain this column?
                var maxOverlappingVertical = 0;
                // get the max vertical overlap of those cells
                // only need to do this step for columns not rows because it has to do with vertical start/end points in block cells
                var firstCellInRoute = that.getCell(link.route.cellLocations[0].col,link.route.cellLocations[0].row);
                var lastCellInRoute = that.getCell(link.route.cellLocations[link.route.cellLocations.length-1].col, link.route.cellLocations[link.route.cellLocations.length-1].row);
                routeCellsInThisCol.forEach(function(cell) {
                    var excludeStartPoints = (cell === lastCellInRoute);
                    var excludeEndPoints = (cell === firstCellInRoute);
                    //excludeStartPoints = false;
                    //excludeEndPoints = false;
                    maxOverlappingVertical = Math.max(maxOverlappingVertical, cell.countVerticalRoutes(excludeStartPoints,excludeEndPoints)); //todo: should we also keep references to the routes this overlaps?
                });
                // store value in a data structure for that col,route pair
                thisColRouteOverlaps.push({
                    route: link.route, // column index can be determined from position in array
                    maxOverlap: maxOverlappingVertical
                });
            }
        });
        colRouteOverlaps.push(thisColRouteOverlaps);
    }

    var rowRouteOverlaps = [];
    // for each route in column
    for (var r = 0; r < this.size; r++) {
        var thisRowRouteOverlaps = [];
        that.allLinks().sort(function(link1, link2){
            // vertically sorts them so that links starting near horizontal center of block are below those
            // starting near edges, so they don't overlap. requires that we sort horizontally before vertically
            var centerIndex = Math.ceil((horizontallySortedLinks.length-1)/2);
            var index1 = horizontallySortedLinks.indexOf(link1);
            var distFromCenter1 = Math.abs(index1 - centerIndex);
            var index2 = horizontallySortedLinks.indexOf(link2);
            var distFromCenter2 = Math.abs(index2 - centerIndex);
            return distFromCenter2 - distFromCenter1;
            //return 10 * (p1.vertical - p2.vertical) + 1 * (Math.abs(p2.horizontal) - Math.abs(p1.horizontal));

        }).forEach( function(link) {

        //this.forEachLink( function(link) {
            var routeCellsInThisRow = link.route.allCells.filter(function(cell){return cell.location.row === r;});
            if (routeCellsInThisRow.length > 0) { // does this route contain this column?
                var maxOverlappingHorizontal = 0;
                routeCellsInThisRow.forEach(function(cell) {
                    maxOverlappingHorizontal = Math.max(maxOverlappingHorizontal, cell.countHorizontalRoutes());
                });
                thisRowRouteOverlaps.push({
                    route: link.route, // column index can be determined from position in array
                    maxOverlap: maxOverlappingHorizontal
                });
            }
        });
        rowRouteOverlaps.push(thisRowRouteOverlaps);
    }
    return {
        colRouteOverlaps: colRouteOverlaps,
        rowRouteOverlaps: rowRouteOverlaps
    };
};

// After routes have been calculated and overlaps have been counted, determines the x,y offset for
// each point so that routes don't overlap one another and are spaced evenly within the cells
Grid.prototype.calculateOffsets = function(overlaps) {
    var colRouteOverlaps = overlaps.colRouteOverlaps;
    var rowRouteOverlaps = overlaps.rowRouteOverlaps;

    var that = this;

    for (var c = 0; c < this.size; c++) {
        var maxOffset = 0.5 * this.getCellWidth(c);
        var minOffset = -1 * maxOffset;

        var routeOverlaps = colRouteOverlaps[c];

        var numRoutesProcessed = new Array(this.size).fill(0);
        var numRoutesProcessedExcludingStart = new Array(this.size).fill(0);
        var numRoutesProcessedExcludingEnd = new Array(this.size).fill(0);

        routeOverlaps.forEach( function(routeOverlap) {
            var route = routeOverlap.route;
            var maxOverlap = routeOverlap.maxOverlap;

            var firstCellInRoute = that.getCell(route.cellLocations[0].col, route.cellLocations[0].row);
            var lastCellInRoute = that.getCell(route.cellLocations[route.cellLocations.length-1].col, route.cellLocations[route.cellLocations.length-1].row);

            var lineNumber = 0;
            route.allCells.filter(function(cell){return cell.location.col === c;}).forEach( function(cell) {
                var numProcessed = 0;

                if (cell === firstCellInRoute) {
                    // exclude endpoints... use numRoutesProcessedExcludingEnd
                    numProcessed = numRoutesProcessedExcludingEnd[cell.location.row];
                } else if (cell === lastCellInRoute) {
                    // exclude startpoints... use numRoutesProcessedExcludingStart
                    numProcessed = numRoutesProcessedExcludingStart[cell.location.row];
                } else {
                    numProcessed = numRoutesProcessed[cell.location.row];
                }

                if (cell.containsVerticalSegmentOfRoute(route)) {
                    lineNumber = Math.max(lineNumber, numProcessed);
                }
            });
            lineNumber += 1;

            // todo: use maxOverlap of any route in this cell? or does maxOverlap already take care of that?
            var numPartitions = maxOverlap + 1;
            var width = maxOffset - minOffset;
            var spacing = width/(numPartitions);
            var offsetX = minOffset + lineNumber * spacing;
            if (maxOverlap === 0) offsetX = 0; // edge case - never adjust lines that don't overlap anything

            route.cellLocations.filter(function(location){return location.col === c;}).forEach( function(location) {
                location.offsetX = offsetX;
            });

            route.allCells.filter(function(cell){return cell.location.col === c}).forEach( function(cell) {
                if (cell !== firstCellInRoute) {
                    // exclude endpoints... use numRoutesProcessedExcludingEnd
                    numRoutesProcessedExcludingStart[cell.location.row] += 1;

                }
                if (cell !== lastCellInRoute) {
                    // exclude startpoints... use numRoutesProcessedExcludingStart
                    numRoutesProcessedExcludingEnd[cell.location.row] += 1;

                } //else {

                if (cell.containsVerticalSegmentOfRoute(route)) {
                    numRoutesProcessed[cell.location.row] += 1;
                }
            });
        });
        //console.log("col numRoutesProcessed", numRoutesProcessed);
    }

    for (var r = 0; r < this.size; r++) {
        var maxOffset = 0.5 * this.getCellHeight(r);
        var minOffset = -1 * maxOffset;
        var routeOverlaps = rowRouteOverlaps[r];
        var numRoutesProcessed = new Array(this.size).fill(0);

        routeOverlaps.forEach( function(routeOverlap) {
            var route = routeOverlap.route;
            var maxOverlap = routeOverlap.maxOverlap;

            var lineNumber = 0;
            route.allCells.filter(function(cell){return cell.location.row === r;}).forEach( function(cell) {
                if (cell.containsHorizontalSegmentOfRoute(route)) {
                    lineNumber = Math.max(lineNumber, numRoutesProcessed[cell.location.col]);
                }
            });
            lineNumber += 1; // actual number is one bigger than the number of routes processed
            // note: line number should never exceed maxOverlap... something went wrong if it did...

            // todo: use maxOverlap of any route in this cell? causes more things to shift but would make more correct
            var numPartitions = maxOverlap + 1;
            var width = maxOffset - minOffset;
            var spacing = width/(numPartitions);
            var offsetY = minOffset + lineNumber * spacing;
            if (maxOverlap === 0) offsetY = 0; // edge case - never adjust lines that don't overlap anything

            route.cellLocations.filter(function(location){return location.row === r;}).forEach( function(location) {
                location.offsetY = offsetY;
            });

            route.allCells.filter(function(cell){return cell.location.row === r}).forEach( function(cell) {
                if (cell.containsHorizontalSegmentOfRoute(route)) {
                    numRoutesProcessed[cell.location.col] += 1;
                }
            });
        });
        //console.log("row numRoutesProcessed", numRoutesProcessed);
    }
};


////////////////////////////////////////////////////////////////////////////////
//      misc functions for working with blocks and grids
////////////////////////////////////////////////////////////////////////////////

function createBlock(x,y,blockSize,name) {
    var block = new Block();
    block.x = x;
    block.y = y;
    block.blockSize = blockSize;
    block.name = name;
    return block;
}

function getBlock(x,y) {
    for (var blockKey in globalStates.currentLogic.blocks) {
        var block = globalStates.currentLogic.blocks[blockKey];
        if (block.x === x && block.y === y) {
            return block;
        }
    }
    return null;
}

function getCellForBlock(grid, block, item) {
    var gridPos = convertBlockPosToGridPos(block.x + item, block.y);
    return grid.getCell(gridPos.col, gridPos.row);
}

Grid.prototype.getCellsOver = function (firstCell,blockWidth,itemSelected,includeMarginCells) {
    var cells = [];
    var increment = includeMarginCells ? 1 : 2;
    for (var col = firstCell.location.col; col < firstCell.location.col + 2 * blockWidth - 1; col += increment) {
        cells.push(this.getCell(col - (itemSelected * 2), firstCell.location.row))
    }
    return cells;
}

Grid.prototype.getCellFromPointerPosition = function(xCoord, yCoord) {
    var col;
    var row;

    var colPairIndex = xCoord / (this.blockColWidth + this.marginColWidth);
    var fraction = colPairIndex - Math.floor(colPairIndex);

    if (fraction <= this.blockColWidth / (this.blockColWidth + this.marginColWidth)) {
        col = Math.floor(colPairIndex) * 2;
    } else {
        col = Math.floor(colPairIndex) * 2 + 1;
    }

    var rowPairIndex = yCoord / (this.blockRowHeight + this.marginRowHeight);
    var fraction = rowPairIndex - Math.floor(rowPairIndex);

    if (fraction <= this.blockRowHeight / (this.blockRowHeight + this.marginRowHeight)) {
        row = Math.floor(rowPairIndex) * 2;
    } else {
        row = Math.floor(rowPairIndex) * 2 + 1;
    }

    return this.getCell(col, row);
}

// gets a block overlapping the cell at this x,y location
function getBlockXY(x, y) {
    // check if block of size >= 1 is at (x, y)
    var block = null;
    block = getBlock(x,y);
    if (block && block.blockSize >= 1) {
        return block;
    }
    // else check if block of size >= 2 is at (x-1, y)
    block = getBlock(x-1,y);
    if (block && block.blockSize >= 2) {
        return block;
    }
    // else check if block of size >= 3 is at (x-2, y)
    block = getBlock(x-2,y);
    if (block && block.blockSize >= 3) {
        return block;
    }

    // else check if block of size == 4 is at (x-3, y)
    block = getBlock(x-3,y);
    if (block && block.blockSize >= 4) {
        return block;
    }
    return null;
}

function convertGridPosToBlockPos(col, row) {
// Grid.prototype.convertGridPosToBlockPos = function(col, row) {
    return {
        x: Math.floor(col/2),
        y: Math.floor(row/2)
    };
}

function convertBlockPosToGridPos(x, y) {
//Grid.prototype.convertBlockPosToGridPos = function(x, y) {
    return new CellLocation(x * 2, y * 2);
}
