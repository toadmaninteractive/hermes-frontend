export interface DeliveryLogs {
    created_at: Date;
    errors: Array<string>;
    message: string;
    success: boolean;
}

export interface DeliveryStats {
    total_errors: number;
    total_ignored: number;
    total_succeeded: number;
}

export interface DeliveryData {
    logs: Array<DeliveryLogs>;
    stats: DeliveryStats;
}

export enum FilterType {
    Success,
    Ignored,
    Error,
    All
}
