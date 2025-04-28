import packageJson from '../../../../package.json';

export class Constants {
    public static readonly companyTitle = 'Your Company';
    public static readonly companyWebsiteUrl = 'https://yourcompany.com';
    public static readonly companyEmailDomain = 'yourcompany.com';
    public static readonly yearFrom = 2020;
    public static readonly yearTo?: number = new Date().getFullYear() > Constants.yearFrom ? new Date().getFullYear() : null;
    public static readonly slackTeamId = 'CHANGE_ME';
    public static readonly slackDeveloperTeamId = 'CHANGE_ME';
    public static readonly slackDeveloperTeamUrl = `slack://channel?team=${Constants.slackTeamId}&id=${Constants.slackDeveloperTeamId}`;
    public static readonly slackDeveloperLeadId = 'CHANGE_ME';
    public static readonly slackDeveloperLeadDmUrl = `slack://user?team=${Constants.slackTeamId}&id=${Constants.slackDeveloperLeadId}`;
    public static readonly slackSysadminId = 'CHANGE_ME';
    public static readonly slackSysadminDmUrl = `slack://user?team=${Constants.slackTeamId}&id=${Constants.slackSysadminId}`;
    public static readonly storedRouteKey = '$storedRoute';
    public static readonly loginUrl = '/auth';
    public static readonly defaultUrl = '/';
    public static readonly version = packageJson.version;
}
