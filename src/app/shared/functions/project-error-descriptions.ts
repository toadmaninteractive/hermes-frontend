export enum ProjectError {
    InvalidTitle = 1,
    InvalidKey = 2,
    InvalidSupervisorId = 3,
    InvalidLeadingOfficeId = 4,
    InvalidColor = 5,
    InvalidFinanceCode = 6,
    InvalidInvoiceable = 7,
    InvalidTaskCode = 8,
    SupervisorNotExists = 9,
    LeadingOfficeNotExists = 10,
    TitleAlreadyExists = 11,
    KeyAlreadyExists = 12,
    UnableToArchive = 13,
    UnableToUnzip = 14
}

export function getErrorDescription(value: ProjectError): string {
    switch (value) {
        case ProjectError.InvalidTitle:
            return 'invalid_title';
        case ProjectError.InvalidKey:
            return 'invalid_key';
        case ProjectError.InvalidSupervisorId:
            return 'invalid_supervisor_id';
        case ProjectError.InvalidLeadingOfficeId:
            return 'invalid_leading_office_id';
        case ProjectError.InvalidColor:
            return 'invalid_color';
        case ProjectError.InvalidFinanceCode:
            return 'invalid_finance_code';
        case ProjectError.InvalidInvoiceable:
            return 'invalid_invoiceable';
        case ProjectError.InvalidTaskCode:
            return 'invalid_task_code';
        case ProjectError.SupervisorNotExists:
            return 'supervisor_not_exists';
        case ProjectError.LeadingOfficeNotExists:
            return 'leading_office_not_exists';
        case ProjectError.TitleAlreadyExists:
            return 'title_already_exists';
        case ProjectError.KeyAlreadyExists:
            return 'key_already_exists';
        case ProjectError.UnableToArchive:
            return 'unable_to_archive';
        case ProjectError.UnableToUnzip:
            return 'unable_to_unzip';
        default:
            return `Invalid ProjectError value: ${value}`;
    }
}
