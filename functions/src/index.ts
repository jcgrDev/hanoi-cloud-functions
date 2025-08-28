/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import {setGlobalOptions} from "firebase-functions";
import {HttpsError, onCall} from "firebase-functions/https";
import {initializeApp} from "firebase-admin/app";
import * as logger from "firebase-functions/logger";

// Initialize Firebase app
initializeApp();

// Set option for cost control
setGlobalOptions({maxInstances: 1});


// Data Models
interface HanoiMove {
    id: string;
    from: string;
    to: string;
    disk: number;
    description: string;
}

interface HanoiSolution {
    numberOfDisks: number;
    moves: HanoiMove[];
    totalMoves: number;
    source: string;
    isValid: boolean;
}

interface SolutionRequest {
    numberOfDisks: number;
}

interface SolutionResponse {
    success: boolean;
    solution?: HanoiSolution;
    error?: string;
}

/**
 * Cloud-based Tower of Hanoi solver implementation
 */
class HanoiCloudSolver {
    /**
     * Generates a complete solution for the Tower of Hanoi puzzle
     * @param {number} numberOfDisks - Number of disks in the puzzle (1-8)
     * @return {HanoiSolution} The complete solution with moves
     */
    generateSolution(numberOfDisks: number): HanoiSolution {
        // Input validation
        if (numberOfDisks < 1 || numberOfDisks > 8) {
            throw new Error("Number of disks must be between 1 and 8.");
        }

        const moves: HanoiMove[] = [];
        const simulationRods: number[][] = [[], [], []];

        // Initialize simulation with disks
        for (let i = numberOfDisks; i >= 1; i--) {
            simulationRods[0].push(i);
        }

        // Generate solution using recursive algorithm
        this.solveHanoi(numberOfDisks, 0, 2, 1, simulationRods, moves);

        const solution: HanoiSolution = {
            numberOfDisks: numberOfDisks,
            moves: moves,
            totalMoves: moves.length,
            source: "cloud_generated",
            isValid: this.validateSolution(moves, numberOfDisks),
        };
        return solution;
    }

    /**
     * Recursive solver for Tower of Hanoi puzzle
     * @param {number} n Number of disks to move
     * @param {number} from Source rod index (0-2)
     * @param {number} to Destination rod index (0-2)
     * @param {number} auxiliary Helper rod index (0-2)
     * @param {number[][]} rods Current state of all rods
     * @param {HanoiMove[]} moves Array to collect moves
     */
    private solveHanoi(
        n: number,
        from: number,
        to: number,
        auxiliary: number,
        rods: number[][],
        moves: HanoiMove[]
    ): void {
        const rodNames = ["A", "B", "C"];

        // Safety checks
        if (n <= 0) return;
        if (from < 0 || from > 2 || to < 0 || to > 2 ||
            auxiliary < 0 || auxiliary > 2) return;
        if (from === to || from === auxiliary || to === auxiliary) return;

        // Base case: Move one disk directly
        if (n === 1) {
            if (rods[from].length === 0) return; // No disk to move
            const disk = rods[from].pop();
            if (disk === undefined) return;
            rods[to].push(disk);
            moves.push({
                id: `move-${moves.length + 1}`,
                from: rodNames[from],
                to: rodNames[to],
                disk: disk,
                description:
                    `Take disk ${disk} from rod ${rodNames[from]} ` +
                    `to rod ${rodNames[to]}`,
            });
            return;
        }

        // Recursive case: three phases
        // Phase 1: Move n-1 disks from 'from' to 'auxiliary'
        this.solveHanoi(n - 1, from, auxiliary, to, rods, moves);

        // Phase 2: Move largest disk from source to destination
        if (rods[from].length === 0) return; // No disk to move
        const disk = rods[from].pop();
        if (disk === undefined) return;
        rods[to].push(disk);
        moves.push({
            id: `move-${moves.length + 1}`,
            from: rodNames[from],
            to: rodNames[to],
            disk: disk,
            description:
                `Take disk ${disk} from rod ${rodNames[from]} ` +
                `to rod ${rodNames[to]}`,
        });

        // Phase 3: Move n-1 disks from auxiliary to destination
        this.solveHanoi(n - 1, auxiliary, to, from, rods, moves);
    }

    /**
     * Validates that a solution is correct for the given number of disks
     * @param {HanoiMove[]} moves - Array of moves to validate
     * @param {number} numberOfDisks - Number of disks in the puzzle
     * @return {boolean} True if solution is valid
     */
    private validateSolution(moves: HanoiMove[], numberOfDisks: number):
        boolean {
        const expectedMoves = Math.pow(2, numberOfDisks) - 1;
        const hasCorrectMoveCount = moves.length === expectedMoves;
        const allMovesValid = moves.every((move) => this.isValidMove(move));

        return hasCorrectMoveCount && allMovesValid;
    }

    /**
     * Validates that a single move is structurally correct
     * @param {HanoiMove} move - The move to validate
     * @return {boolean} True if move is valid
     */
    private isValidMove(move: HanoiMove): boolean {
        const validRods = ["A", "B", "C"];
        return validRods.includes(move.from) &&
               validRods.includes(move.to) &&
               move.from !== move.to &&
               move.disk > 0;
    }
}

/**
 * Cloud function to get Tower of Hanoi solution
 * @param {any} request - Firebase callable function request
 * @return {Promise<SolutionResponse>} The solution or error response
 */
export const getTowerOfHanoiSolution = onCall(async (request):
    Promise<SolutionResponse> => {
    try {
        const data = request.data as SolutionRequest;
        const {numberOfDisks} = data;

        // Validation
        if (!numberOfDisks || typeof numberOfDisks !== "number") {
            throw new HttpsError("invalid-argument",
                "numberOfDisks must be a number.");
        }

        if (numberOfDisks < 1 || numberOfDisks > 8) {
            throw new HttpsError("invalid-argument",
                "numberOfDisks must be between 1 and 8.");
        }

        logger.info(`📱 Solution request: ${numberOfDisks} disks`);

        // Generate new solution
        const solver = new HanoiCloudSolver();
        const solution = solver.generateSolution(numberOfDisks);

        logger.info(
            `✅ Generated solution for ${numberOfDisks} disks with ` +
            `${solution.totalMoves} moves`
        );

        return {
            success: true,
            solution: solution,
        };
    } catch (error) {
        logger.error("Error generating solution:", error);
        return {success: false, error: "Internal server error."};
    }
});