import { SortDirection } from '@angular/material/sort';

export enum Column {
    Id = 'id',
    Period = 'period',
    Omitted = 'omitted',
    Comment = 'comment',
    CreatedBy = 'createdBy',
    CreatedAt = 'createdAt',
    Actions = 'actions',
    DeliveredAt = 'deliveredAt',
    DeliveryStatus = 'deliveryStatus'
}

export const DEFAULT_ORDER_BY = Column.Id;
export const DEFAULT_ORDER_DIR: SortDirection = 'desc';
export const DEFAULT_PAGE_SIZE = 10;
export const DEFAULT_COLUMNS = [
    Column.Id,
    Column.Omitted,
    Column.Comment,
    Column.CreatedBy,
    Column.CreatedAt,
    Column.DeliveryStatus,
    Column.DeliveredAt,
    Column.Actions
];
