import { Office, PersonnelAccount, Project, Role, Team } from '../../protocol/db-protocol';

export interface AllocateData {
    projects: Project[];
    title: string;
    projectAllocatedId: number;
    header: string;
}

export interface AllocateEmployeeData {
    employees: PersonnelAccount[];
}

export interface OfficeData {
    officeId: number | null;
    header: string;
}
export interface TeamData {
    teams: Team[];
    currentTeam: Team;
}

export interface ProjectsData {
    projects: Project[];
    currentProject: Project;
    url: string;
}

export interface RoleData {
    roles: Role[];
    allowedRoles: Set<number>;
    currentRole: string;
    currentRoleId: number;
    header: string;
}

export interface OneInputDialogData {
    header?: string;
    input?: string;
}

export interface OfficeRolesDialogData {
    office: Office;
    payload: Role[];
}

export interface RoleReportDialogData {
    officeId: number;
    date: Date;
}

export interface ReportCreateDialogData {
    officeId: number;
    officeRolesId: number[];
    date: Date;
}
