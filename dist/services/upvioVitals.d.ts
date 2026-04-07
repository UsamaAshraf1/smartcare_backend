export type VitalsLinkStatus = 'ACTIVE' | 'ARCHIVED' | 'DISABLED';
export type VitalsScanStatus = 'PENDING' | 'STARTED' | 'SUCCEEDED' | 'FAILED' | 'ABORTED';
export interface VitalsLink {
    id: string;
    name: string;
    description: string | null;
    slug: string;
    status: VitalsLinkStatus;
    vitalsTemplateId: string;
    scansCount: number;
    maxScans: number | null;
    expiresAt: string | null;
    createdAt: string;
    updatedAt: string;
}
export interface VitalsScanMetrics {
    heartRate: number | null;
    heartRateVariability: number | null;
    breathingRate: number | null;
    stressIndex: number | null;
    parasympatheticActivity: number | null;
    cardiacWorkload: number | null;
    bloodPressureDiastolic: number | null;
    bloodPressureSystolic: number | null;
    bmiClassification: number | null;
    wellnessScore: number | null;
    vascularAge: number | null;
    atheroscleroticCvdRisk: number | null;
    cardiovascularEventRisk: number | null;
    cardiovascularRiskScore: number | null;
    hypertensionRisk: number | null;
    diabetesRisk: number | null;
    fattyLiverDiseaseRisk: number | null;
    waistToHeightRatio: number | null;
    bodyFatPercentage: number | null;
    bodyRoundnessIndex: number | null;
    aBodyShapeIndex: number | null;
    conicityIndex: number | null;
    basalMetabolicRate: number | null;
    totalDailyEnergyExpenditure: number | null;
}
export interface VitalsScanResults {
    metrics: VitalsScanMetrics;
}
export interface VitalsScan {
    id: string;
    patientId: string;
    vitalsLinkId: string;
    status: VitalsScanStatus;
    results: VitalsScanResults | null;
    includedMetrics: string[];
    startedAt: string | null;
    createdAt: string;
    updatedAt: string;
}
export interface VitalsTemplate {
    id: string;
    name: string;
    description: string | null;
    credits: number;
    metrics: string[];
    linksCount: number;
    archivedAt: string | null;
    createdAt: string;
    updatedAt: string;
}
export declare function listVitalsLinks(params?: {
    limit?: number;
    offset?: number;
    status?: VitalsLinkStatus;
    vitalsTemplateId?: string;
}, businessId?: string): Promise<{
    data: VitalsLink[];
    meta: {
        totalCount: number;
    };
}>;
export declare function getVitalsLink(linkId: string, businessId?: string): Promise<{
    data: VitalsLink;
}>;
export declare function listScans(params?: {
    limit?: number;
    offset?: number;
    patientId?: string;
    vitalsLinkId?: string;
}, businessId?: string): Promise<{
    data: VitalsScan[];
    meta: {
        totalCount: number;
    };
}>;
export declare function getScan(scanId: string, businessId?: string): Promise<{
    data: VitalsScan;
}>;
export declare function listTemplates(businessId?: string): Promise<{
    data: VitalsTemplate[];
    meta: {
        totalCount: number;
    };
}>;
export declare function getTemplate(templateId: string, businessId?: string): Promise<{
    data: VitalsTemplate;
}>;
export declare function getScanUrl(slug: string): string;
export declare function formatMetrics(metrics: VitalsScanMetrics): {
    vitals: {
        heartRate: string | null;
        heartRateVariability: string | null;
        breathingRate: string | null;
        bloodPressure: string | null;
        stressIndex: string | null;
    };
    wellness: {
        wellnessScore: string | null;
        vascularAge: string | null;
        cardiacWorkload: string | null;
    };
    risks: {
        cardiovascularRisk: string | null;
        hypertensionRisk: string | null;
        diabetesRisk: string | null;
        fattyLiverRisk: string | null;
    };
    body: {
        bodyFatPercentage: string | null;
        bmiClassification: string | null;
        basalMetabolicRate: string | null;
    };
};
declare const _default: {
    listVitalsLinks: typeof listVitalsLinks;
    getVitalsLink: typeof getVitalsLink;
    listScans: typeof listScans;
    getScan: typeof getScan;
    listTemplates: typeof listTemplates;
    getTemplate: typeof getTemplate;
    getScanUrl: typeof getScanUrl;
    formatMetrics: typeof formatMetrics;
};
export default _default;
//# sourceMappingURL=upvioVitals.d.ts.map