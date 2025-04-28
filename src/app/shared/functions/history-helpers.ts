import { HistoryOperation } from '../../protocol/db-protocol';

export function getOperationDescription(value: HistoryOperation): string {
    switch (value) {
        case HistoryOperation.Create:
            return 'created';
        case HistoryOperation.Read:
            return 'read';
        case HistoryOperation.Update:
            return 'updated';
        case HistoryOperation.Delete:
            return 'deleted';
        case HistoryOperation.Undelete:
            return 'undeleted';
        case HistoryOperation.Block:
            return 'blocked';
        case HistoryOperation.Unblock:
            return 'unblocked';
        case HistoryOperation.Login:
            return 'login';
        case HistoryOperation.Logout:
            return 'logout';
        case HistoryOperation.Allocate:
            return 'allocated';
        case HistoryOperation.Deallocate:
            return 'deallocated';
        case HistoryOperation.Protect:
            return 'protected';
        case HistoryOperation.Unprotect:
            return 'unprotected';
        case HistoryOperation.Absence:
            return 'set absence for';
        default:
            return '';
    }
}
