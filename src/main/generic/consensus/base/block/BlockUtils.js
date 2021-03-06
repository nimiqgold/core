class BlockUtils {
    /**
     * @param {number} compact
     * @returns {number}
     */
    static compactToTarget(compact) {
        return (compact & 0xffffff) * Math.pow(2, (8 * ((compact >> 24) - 3)));
    }

    /**
     * @param {number} target
     * @returns {number}
     */
    static targetToCompact(target) {
        if (!Number.isFinite(target) || Number.isNaN(target)) throw 'Invalid Target';

        // Divide to get first byte
        let size = Math.max(Math.ceil(Math.log2(target) / 8), 1);
        const firstByte = target / Math.pow(2, (size - 1) * 8);

        // If the first (most significant) byte is greater than 127 (0x7f),
        // prepend a zero byte.
        if (firstByte >= 0x80) {
            size++;
        }

        // The first byte of the 'compact' format is the number of bytes,
        // including the prepended zero if it's present.
        // The following three bytes are the first three bytes of the above
        // representation. If less than three bytes are present, then one or
        // more of the last bytes of the compact representation will be zero.
        return (size << 24) + ((target / Math.pow(2, (size - 3) * 8)) & 0xffffff);
    }

    /**
     * @param {number} target
     * @returns {number}
     */
    static getTargetHeight(target) {
        return Math.ceil(Math.log2(target));
    }

    /**
     * @param {number} target
     * @returns {number}
     */
    static getTargetDepth(target) {
        return BlockUtils.getTargetHeight(Policy.BLOCK_TARGET_MAX) - BlockUtils.getTargetHeight(target);
    }

    /**
     * @param {number} compact
     * @returns {number}
     */
    static compactToDifficulty(compact) {
        return Policy.BLOCK_TARGET_MAX / BlockUtils.compactToTarget(compact);
    }

    /**
     * @param {number} difficulty
     * @returns {number}
     */
    static difficultyToCompact(difficulty) {
        return BlockUtils.targetToCompact(BlockUtils.difficultyToTarget(difficulty));
    }

    /**
     * @param {number} difficulty
     * @returns {number}
     */
    static difficultyToTarget(difficulty) {
        return Policy.BLOCK_TARGET_MAX / difficulty;
    }

    /**
     * @param {number} target
     * @returns {number}
     */
    static targetToDifficulty(target) {
        return Policy.BLOCK_TARGET_MAX / target;
    }

    /**
     * @param {Hash} hash
     * @returns {number}
     */
    static hashToTarget(hash) {
        return parseInt(hash.toHex(), 16);
    }

    /**
     * @param {Hash} hash
     * @returns {number}
     */
    static realDifficulty(hash) {
        return BlockUtils.targetToDifficulty(BlockUtils.hashToTarget(hash));
    }

    /**
     * @param {Hash} hash
     * @returns {number}
     */
    static getHashDepth(hash) {
        return BlockUtils.getTargetDepth(BlockUtils.hashToTarget(hash));
    }

    /**
     * @param {Hash} hash
     * @param {number} target
     * @returns {boolean}
     */
    static isProofOfWork(hash, target) {
        return parseInt(hash.toHex(), 16) <= target;
    }

    /**
     * @param {number} compact
     * @returns {boolean}
     */

    static isValidCompact(compact) {
        return BlockUtils.isValidTarget(BlockUtils.compactToTarget(compact));
    }

    /**
     * @param {number} target
     * @returns {boolean}
     */
    static isValidTarget(target) {
        return target >= 1 && target <= Policy.BLOCK_TARGET_MAX;
    }

    /**
     * @param {BlockHeader} headBlock
     * @param {BlockHeader} tailBlock
     * @param {number} deltaTotalDifficulty
     * @returns {number}
     */
    static getNextTarget(headBlock, tailBlock, deltaTotalDifficulty) {
        Assert.that(
            (headBlock.height - tailBlock.height === Policy.DIFFICULTY_BLOCK_WINDOW)
                || (headBlock.height <= Policy.DIFFICULTY_BLOCK_WINDOW && tailBlock.height === 1),
            `Tail and head block must be ${Policy.DIFFICULTY_BLOCK_WINDOW} blocks apart`);

        let actualTime = headBlock.timestamp - tailBlock.timestamp;

        // Simulate that the Policy.BLOCK_TIME was achieved for the blocks before the genesis block, i.e. we simulate
        // a sliding window that starts before the genesis block. Assume difficulty = 1 for these blocks.
        if (headBlock.height <= Policy.DIFFICULTY_BLOCK_WINDOW) {
            actualTime += (Policy.DIFFICULTY_BLOCK_WINDOW - headBlock.height + 1) * Policy.BLOCK_TIME;
            deltaTotalDifficulty += Policy.DIFFICULTY_BLOCK_WINDOW - headBlock.height + 1;
        }

        // Compute the target adjustment factor.
        const expectedTime = Policy.DIFFICULTY_BLOCK_WINDOW * Policy.BLOCK_TIME;
        let adjustment = actualTime / expectedTime;

        // Clamp the adjustment factor to [1 / MAX_ADJUSTMENT_FACTOR, MAX_ADJUSTMENT_FACTOR].
        adjustment = Math.max(adjustment, 1 / Policy.DIFFICULTY_MAX_ADJUSTMENT_FACTOR);
        adjustment = Math.min(adjustment, Policy.DIFFICULTY_MAX_ADJUSTMENT_FACTOR);

        // Compute the next target.
        const averageDifficulty = deltaTotalDifficulty / Policy.DIFFICULTY_BLOCK_WINDOW;
        const averageTarget = BlockUtils.difficultyToTarget(averageDifficulty);
        let nextTarget = averageTarget * adjustment;

        // Make sure the target is below or equal the maximum allowed target (difficulty 1).
        // Also enforce a minimum target of 1.
        nextTarget = Math.min(nextTarget, Policy.BLOCK_TARGET_MAX);
        nextTarget = Math.max(nextTarget, 1);

        // XXX Reduce target precision to nBits precision.
        const nBits = BlockUtils.targetToCompact(nextTarget);
        return BlockUtils.compactToTarget(nBits);
    }
}
Class.register(BlockUtils);
