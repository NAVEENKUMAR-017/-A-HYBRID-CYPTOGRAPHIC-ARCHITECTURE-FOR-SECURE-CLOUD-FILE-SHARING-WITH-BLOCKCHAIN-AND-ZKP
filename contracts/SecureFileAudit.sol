// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title SecureFileAudit
 * @notice Immutable audit trail for file upload, share, access, and revoke events.
 *         Stores only metadata (hashes, IDs, timestamps) — never raw file data.
 */
contract SecureFileAudit {

    // ─── Enums ───────────────────────────────────────────────────────────────
    enum EventType { UPLOAD, SHARE, ACCESS, REVOKE, ZKP_VERIFY }

    // ─── Structs ─────────────────────────────────────────────────────────────
    struct AuditRecord {
        uint256  id;
        EventType eventType;
        address  actor;           // wallet address of user performing action
        bytes32  fileHash;        // SHA-256 of encrypted file
        string   fileId;          // S3 object key
        address  delegate;        // for SHARE/REVOKE: recipient address
        bytes32  zkpProofHash;    // hash of ZKP proof (for ZKP_VERIFY events)
        uint256  timestamp;
        bool     valid;
    }

    // ─── State ───────────────────────────────────────────────────────────────
    uint256 private _recordCount;
    mapping(uint256 => AuditRecord) private _records;
    mapping(string  => uint256[])   private _fileRecords;   // fileId → record IDs
    mapping(address => uint256[])   private _userRecords;   // user   → record IDs
    mapping(string  => address)     private _fileOwner;     // fileId → owner
    mapping(string  => mapping(address => bool)) private _accessList; // fileId → delegate → bool

    // ─── Events ──────────────────────────────────────────────────────────────
    event RecordAdded(uint256 indexed id, EventType indexed eventType, address indexed actor, string fileId, uint256 timestamp);
    event AccessGranted(string indexed fileId, address indexed owner, address indexed delegate);
    event AccessRevoked(string indexed fileId, address indexed owner, address indexed delegate);

    // ─── Modifiers ───────────────────────────────────────────────────────────
    modifier onlyFileOwner(string memory fileId) {
        require(_fileOwner[fileId] == msg.sender, "Not file owner");
        _;
    }

    // ─── Write Functions ─────────────────────────────────────────────────────

    /**
     * @notice Record a file upload event and register ownership.
     */
    function recordUpload(
        bytes32 fileHash,
        string  calldata fileId
    ) external returns (uint256) {
        require(_fileOwner[fileId] == address(0), "File already registered");
        _fileOwner[fileId] = msg.sender;

        return _addRecord(EventType.UPLOAD, msg.sender, fileHash, fileId, address(0), bytes32(0));
    }

    /**
     * @notice Record a proxy re-encryption / share delegation event.
     */
    function recordShare(
        bytes32 fileHash,
        string  calldata fileId,
        address delegate
    ) external onlyFileOwner(fileId) returns (uint256) {
        require(delegate != address(0), "Invalid delegate");
        _accessList[fileId][delegate] = true;

        emit AccessGranted(fileId, msg.sender, delegate);
        return _addRecord(EventType.SHARE, msg.sender, fileHash, fileId, delegate, bytes32(0));
    }

    /**
     * @notice Record a file access event (called after successful ZKP verification).
     */
    function recordAccess(
        bytes32 fileHash,
        string  calldata fileId,
        bytes32 zkpProofHash
    ) external returns (uint256) {
        require(
            _fileOwner[fileId] == msg.sender || _accessList[fileId][msg.sender],
            "Access not authorized"
        );
        return _addRecord(EventType.ACCESS, msg.sender, fileHash, fileId, address(0), zkpProofHash);
    }

    /**
     * @notice Revoke a delegate's access to a file.
     */
    function revokeAccess(
        bytes32 fileHash,
        string  calldata fileId,
        address delegate
    ) external onlyFileOwner(fileId) returns (uint256) {
        _accessList[fileId][delegate] = false;

        emit AccessRevoked(fileId, msg.sender, delegate);
        return _addRecord(EventType.REVOKE, msg.sender, fileHash, fileId, delegate, bytes32(0));
    }

    /**
     * @notice Record a standalone ZKP verification event.
     */
    function recordZKPVerification(
        bytes32 fileHash,
        string  calldata fileId,
        bytes32 proofHash
    ) external returns (uint256) {
        return _addRecord(EventType.ZKP_VERIFY, msg.sender, fileHash, fileId, address(0), proofHash);
    }

    // ─── Read Functions ──────────────────────────────────────────────────────

    function getRecord(uint256 id) external view returns (AuditRecord memory) {
        require(id < _recordCount, "Record does not exist");
        return _records[id];
    }

    function getFileRecords(string calldata fileId) external view returns (uint256[] memory) {
        return _fileRecords[fileId];
    }

    function getUserRecords(address user) external view returns (uint256[] memory) {
        return _userRecords[user];
    }

    function getFileOwner(string calldata fileId) external view returns (address) {
        return _fileOwner[fileId];
    }

    function hasAccess(string calldata fileId, address user) external view returns (bool) {
        return _fileOwner[fileId] == user || _accessList[fileId][user];
    }

    function totalRecords() external view returns (uint256) {
        return _recordCount;
    }

    // ─── Internal ────────────────────────────────────────────────────────────

    function _addRecord(
        EventType  eventType,
        address    actor,
        bytes32    fileHash,
        string memory fileId,
        address    delegate,
        bytes32    zkpProofHash
    ) internal returns (uint256) {
        uint256 id = _recordCount++;
        _records[id] = AuditRecord({
            id:           id,
            eventType:    eventType,
            actor:        actor,
            fileHash:     fileHash,
            fileId:       fileId,
            delegate:     delegate,
            zkpProofHash: zkpProofHash,
            timestamp:    block.timestamp,
            valid:        true
        });
        _fileRecords[fileId].push(id);
        _userRecords[actor].push(id);

        emit RecordAdded(id, eventType, actor, fileId, block.timestamp);
        return id;
    }
}
