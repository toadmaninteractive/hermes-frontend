import { Project } from '../../protocol/db-protocol';

export interface ProjectWithDays {
    project: Project;
    days: number;
}
