{{- define "canfactory.labels" -}}
app.kubernetes.io/name: canfactory
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}
{{- define "canfactory.env" -}}
- name: STORAGE_BACKEND
  value: postgres
- name: PROJECT_ROOT
  value: /app
- name: HOST
  value: "0.0.0.0"
- name: SCRATCH_DIR
  value: /tmp/canfactory
- name: S3_ENDPOINT
  value: {{ .root.Values.storage.endpoint | quote }}
- name: S3_REGION
  value: {{ .root.Values.storage.region | quote }}
- name: S3_CATALOGUE_BUCKET
  value: {{ .root.Values.storage.catalogueBucket | quote }}
- name: S3_GENERATED_BUCKET
  value: {{ .root.Values.storage.generatedBucket | quote }}
{{- range $key := list "DATABASE_URL" "S3_ACCESS_KEY_ID" "S3_SECRET_ACCESS_KEY" }}
- name: {{ $key }}
  valueFrom:
    secretKeyRef:
      name: {{ index $.root.Values.secrets $.role }}
      key: {{ $key }}
{{- end }}
{{- end }}
{{- define "canfactory.security" -}}
allowPrivilegeEscalation: false
readOnlyRootFilesystem: true
capabilities:
  drop: [ALL]
{{- end }}
