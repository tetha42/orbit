export interface ContractEndpoint {
	path: string;
	methods: ('GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE')[];
	description?: string;
}

export interface ContractErrorCode {
	code: string;
	status: number;
	i18nKey: string;
	description?: string;
}

export interface ContractFileMap {
	actions: string[];
	queries: string[];
	ui: string[];
	i18n: string[];
}

export interface ModuleContract {
	$schema?: string;
	id: string;
	name: string;
	version: string;
	description: string;
	tables: string[];
	api: {
		base: string;
		endpoints: ContractEndpoint[];
	};
	limits: Record<string, number | string | boolean>;
	errorCodes: ContractErrorCode[];
	files: ContractFileMap;
}

export interface AiIndexEntry {
	id: string;
	name: string;
	version: string;
	description: string;
	contractPath: string;
	tables: string[];
	apiBase: string;
	endpoints: ContractEndpoint[];
	limits: Record<string, number | string | boolean>;
	errorCodes: ContractErrorCode[];
	files: ContractFileMap;
}

export interface AiIndex {
	generatedAt: string;
	version: string;
	totalModules: number;
	modules: Record<string, AiIndexEntry>;
}
