import TextField from "@mui/material/TextField"
import { Template, UpdateTemplateMeta } from "api/typesGenerated"
import { FormikTouched, useFormik } from "formik"
import { FC, ChangeEvent, useState } from "react"
import { getFormHelpers } from "utils/formUtils"
import { useTranslation } from "react-i18next"
import {
  FormSection,
  HorizontalForm,
  FormFooter,
  FormFields,
} from "components/Form/Form"
import { Stack } from "components/Stack/Stack"
import { makeStyles } from "@mui/styles"
import Link from "@mui/material/Link"
import Checkbox from "@mui/material/Checkbox"
import FormControlLabel from "@mui/material/FormControlLabel"
import Switch from "@mui/material/Switch"
import {
  useWorkspacesToBeLocked,
  useWorkspacesToBeDeleted,
} from "./useWorkspacesToBeDeleted"
import { TemplateScheduleFormValues, getValidationSchema } from "./formHelpers"
import { TTLHelperText } from "./TTLHelperText"
import { docs } from "utils/docs"
import { ScheduleDialog } from "components/Dialogs/ConfirmDialog/ConfirmDialog"

const MS_HOUR_CONVERSION = 3600000
const MS_DAY_CONVERSION = 86400000
const FAILURE_CLEANUP_DEFAULT = 7
const INACTIVITY_CLEANUP_DEFAULT = 180
const LOCKED_CLEANUP_DEFAULT = 30

export interface TemplateScheduleForm {
  template: Template
  onSubmit: (data: UpdateTemplateMeta) => void
  onCancel: () => void
  isSubmitting: boolean
  error?: unknown
  allowAdvancedScheduling: boolean
  allowWorkspaceActions: boolean
  // Helpful to show field errors on Storybook
  initialTouched?: FormikTouched<UpdateTemplateMeta>
}

export const TemplateScheduleForm: FC<TemplateScheduleForm> = ({
  template,
  onSubmit,
  onCancel,
  error,
  allowAdvancedScheduling,
  allowWorkspaceActions,
  isSubmitting,
  initialTouched,
}) => {
  const { t: commonT } = useTranslation("common")
  const validationSchema = getValidationSchema()
  const form = useFormik<TemplateScheduleFormValues>({
    initialValues: {
      // on display, convert from ms => hours
      default_ttl_ms: template.default_ttl_ms / MS_HOUR_CONVERSION,
      // the API ignores these values, but to avoid tripping up validation set
      // it to zero if the user can't set the field.
      max_ttl_ms: allowAdvancedScheduling
        ? template.max_ttl_ms / MS_HOUR_CONVERSION
        : 0,
      failure_ttl_ms: allowAdvancedScheduling
        ? template.failure_ttl_ms / MS_DAY_CONVERSION
        : 0,
      inactivity_ttl_ms: allowAdvancedScheduling
        ? template.inactivity_ttl_ms / MS_DAY_CONVERSION
        : 0,
      locked_ttl_ms: allowAdvancedScheduling
        ? template.locked_ttl_ms / MS_DAY_CONVERSION
        : 0,

      restart_requirement: {
        days_of_week: template.restart_requirement.days_of_week,
        weeks: template.restart_requirement.weeks,
      },

      allow_user_autostart: template.allow_user_autostart,
      allow_user_autostop: template.allow_user_autostop,
      failure_cleanup_enabled:
        allowAdvancedScheduling && Boolean(template.failure_ttl_ms),
      inactivity_cleanup_enabled:
        allowAdvancedScheduling && Boolean(template.inactivity_ttl_ms),
      locked_cleanup_enabled:
        allowAdvancedScheduling && Boolean(template.locked_ttl_ms),
      update_workspace_last_used_at: false,
      update_workspace_locked_at: false,
    },
    validationSchema,
    onSubmit: () => {
      const dormancyChanged =
        form.initialValues.inactivity_ttl_ms !== form.values.inactivity_ttl_ms
      const deletionChanged =
        form.initialValues.locked_ttl_ms !== form.values.locked_ttl_ms

      const dormancyScheduleChanged =
        form.values.inactivity_cleanup_enabled &&
        dormancyChanged &&
        workspacesToDormancyInWeek &&
        workspacesToDormancyInWeek.length > 0

      const deletionScheduleChanged =
        form.values.inactivity_cleanup_enabled &&
        deletionChanged &&
        workspacesToBeDeletedInWeek &&
        workspacesToBeDeletedInWeek.length > 0

      if (dormancyScheduleChanged || deletionScheduleChanged) {
        setIsScheduleDialogOpen(true)
      } else {
        submitValues()
      }
    },
    initialTouched,
  })
  const getFieldHelpers = getFormHelpers<TemplateScheduleFormValues>(
    form,
    error,
  )
  const { t } = useTranslation("templateSettingsPage")
  const styles = useStyles()

  const now = new Date()
  const weekFromNow = new Date(now)
  weekFromNow.setDate(now.getDate() + 7)

  const workspacesToDormancyNow = useWorkspacesToBeLocked(
    template,
    form.values,
    now,
  )

  const workspacesToDormancyInWeek = useWorkspacesToBeLocked(
    template,
    form.values,
    weekFromNow,
  )

  const workspacesToBeDeletedNow = useWorkspacesToBeDeleted(
    template,
    form.values,
    now,
  )

  const workspacesToBeDeletedInWeek = useWorkspacesToBeDeleted(
    template,
    form.values,
    weekFromNow,
  )

  const showScheduleDialog =
    workspacesToDormancyNow &&
    workspacesToBeDeletedNow &&
    workspacesToDormancyInWeek &&
    workspacesToBeDeletedInWeek &&
    (workspacesToDormancyInWeek.length > 0 ||
      workspacesToBeDeletedInWeek.length > 0)

  const [isScheduleDialogOpen, setIsScheduleDialogOpen] =
    useState<boolean>(false)

  const submitValues = () => {
    // on submit, convert from hours => ms
    onSubmit({
      default_ttl_ms: form.values.default_ttl_ms
        ? form.values.default_ttl_ms * MS_HOUR_CONVERSION
        : undefined,
      max_ttl_ms: form.values.max_ttl_ms
        ? form.values.max_ttl_ms * MS_HOUR_CONVERSION
        : undefined,
      failure_ttl_ms: form.values.failure_ttl_ms
        ? form.values.failure_ttl_ms * MS_DAY_CONVERSION
        : undefined,
      inactivity_ttl_ms: form.values.inactivity_ttl_ms
        ? form.values.inactivity_ttl_ms * MS_DAY_CONVERSION
        : undefined,
      locked_ttl_ms: form.values.locked_ttl_ms
        ? form.values.locked_ttl_ms * MS_DAY_CONVERSION
        : undefined,

      allow_user_autostart: form.values.allow_user_autostart,
      allow_user_autostop: form.values.allow_user_autostop,
      update_workspace_last_used_at: form.values.update_workspace_last_used_at,
      update_workspace_locked_at: form.values.update_workspace_locked_at,
    })
  }

  const handleToggleFailureCleanup = async (e: ChangeEvent) => {
    form.handleChange(e)
    if (!form.values.failure_cleanup_enabled) {
      // fill failure_ttl_ms with defaults
      await form.setValues({
        ...form.values,
        failure_cleanup_enabled: true,
        failure_ttl_ms: FAILURE_CLEANUP_DEFAULT,
      })
    } else {
      // clear failure_ttl_ms
      await form.setValues({
        ...form.values,
        failure_cleanup_enabled: false,
        failure_ttl_ms: 0,
      })
    }
  }

  const handleToggleInactivityCleanup = async (e: ChangeEvent) => {
    form.handleChange(e)
    if (!form.values.inactivity_cleanup_enabled) {
      // fill inactivity_ttl_ms with defaults
      await form.setValues({
        ...form.values,
        inactivity_cleanup_enabled: true,
        inactivity_ttl_ms: INACTIVITY_CLEANUP_DEFAULT,
      })
    } else {
      // clear inactivity_ttl_ms
      await form.setValues({
        ...form.values,
        inactivity_cleanup_enabled: false,
        inactivity_ttl_ms: 0,
      })
    }
  }

  const handleToggleLockedCleanup = async (e: ChangeEvent) => {
    form.handleChange(e)
    if (!form.values.locked_cleanup_enabled) {
      // fill failure_ttl_ms with defaults
      await form.setValues({
        ...form.values,
        locked_cleanup_enabled: true,
        locked_ttl_ms: LOCKED_CLEANUP_DEFAULT,
      })
    } else {
      // clear failure_ttl_ms
      await form.setValues({
        ...form.values,
        locked_cleanup_enabled: false,
        locked_ttl_ms: 0,
      })
    }
  }

  return (
    <HorizontalForm
      onSubmit={form.handleSubmit}
      aria-label={t("formAriaLabel").toString()}
    >
      <FormSection
        title={t("schedule.title").toString()}
        description={t("schedule.description").toString()}
      >
        <Stack direction="row" className={styles.ttlFields}>
          <TextField
            {...getFieldHelpers(
              "default_ttl_ms",
              <TTLHelperText
                translationName="defaultTTLHelperText"
                ttl={form.values.default_ttl_ms}
              />,
            )}
            disabled={isSubmitting}
            fullWidth
            inputProps={{ min: 0, step: 1 }}
            label={t("defaultTtlLabel")}
            type="number"
          />

          <TextField
            {...getFieldHelpers(
              "max_ttl_ms",
              allowAdvancedScheduling ? (
                <TTLHelperText
                  translationName="maxTTLHelperText"
                  ttl={form.values.max_ttl_ms}
                />
              ) : (
                <>
                  {commonT("licenseFieldTextHelper")}{" "}
                  <Link href={docs("/enterprise")}>{commonT("learnMore")}</Link>
                  .
                </>
              ),
            )}
            disabled={isSubmitting || !allowAdvancedScheduling}
            fullWidth
            inputProps={{ min: 0, step: 1 }}
            label={t("maxTtlLabel")}
            type="number"
          />
        </Stack>
      </FormSection>

      <FormSection
        title="Allow users scheduling"
        description="Allow users to set custom autostart and autostop scheduling options for workspaces created from this template."
      >
        <Stack direction="column">
          <Stack direction="row" alignItems="center">
            <Checkbox
              id="allow_user_autostart"
              size="small"
              disabled={isSubmitting || !allowAdvancedScheduling}
              onChange={async () => {
                await form.setFieldValue(
                  "allow_user_autostart",
                  !form.values.allow_user_autostart,
                )
              }}
              name="allow_user_autostart"
              checked={form.values.allow_user_autostart}
            />
            <Stack spacing={0.5}>
              <strong>
                Allow users to automatically start workspaces on a schedule.
              </strong>
            </Stack>
          </Stack>
          <Stack direction="row" alignItems="center">
            <Checkbox
              id="allow-user-autostop"
              size="small"
              disabled={isSubmitting || !allowAdvancedScheduling}
              onChange={async () => {
                await form.setFieldValue(
                  "allow_user_autostop",
                  !form.values.allow_user_autostop,
                )
              }}
              name="allow_user_autostop"
              checked={form.values.allow_user_autostop}
            />
            <Stack spacing={0.5}>
              <strong>
                Allow users to customize autostop duration for workspaces.
              </strong>
              <span className={styles.optionDescription}>
                Workspaces will always use the default TTL if this is set.
                Regardless of this setting, workspaces can only stay on for the
                max lifetime.
              </span>
            </Stack>
          </Stack>
        </Stack>
      </FormSection>
      {allowAdvancedScheduling && allowWorkspaceActions && (
        <>
          <FormSection
            title="Failure Cleanup"
            description="When enabled, Coder will attempt to stop workspaces that are in a failed state after a specified number of days."
          >
            <FormFields>
              <FormControlLabel
                control={
                  <Switch
                    name="failureCleanupEnabled"
                    checked={form.values.failure_cleanup_enabled}
                    onChange={handleToggleFailureCleanup}
                  />
                }
                label="Enable Failure Cleanup"
              />
              <TextField
                {...getFieldHelpers(
                  "failure_ttl_ms",
                  <TTLHelperText
                    translationName="failureTTLHelperText"
                    ttl={form.values.failure_ttl_ms}
                  />,
                )}
                disabled={isSubmitting || !form.values.failure_cleanup_enabled}
                fullWidth
                inputProps={{ min: 0, step: "any" }}
                label="Time until cleanup (days)"
                type="number"
              />
            </FormFields>
          </FormSection>
          <FormSection
            title="Dormancy Threshold"
            description="When enabled, Coder will mark workspaces as dormant after a period of time with no connections. Dormant workspaces can be auto-deleted (see below) or manually reviewed by the workspace owner or admins."
          >
            <FormFields>
              <FormControlLabel
                control={
                  <Switch
                    name="dormancyThreshold"
                    checked={form.values.inactivity_cleanup_enabled}
                    onChange={handleToggleInactivityCleanup}
                  />
                }
                label="Enable Dormancy Threshold"
              />
              <TextField
                {...getFieldHelpers(
                  "inactivity_ttl_ms",
                  <TTLHelperText
                    translationName="dormancyThresholdHelperText"
                    ttl={form.values.inactivity_ttl_ms}
                  />,
                )}
                disabled={
                  isSubmitting || !form.values.inactivity_cleanup_enabled
                }
                fullWidth
                inputProps={{ min: 0, step: "any" }}
                label="Time until dormant (days)"
                type="number"
              />
            </FormFields>
          </FormSection>
          <FormSection
            title="Dormancy Auto-Deletion"
            description="When enabled, Coder will permanently delete dormant workspaces after a period of time. Once a workspace is deleted it cannot be recovered."
          >
            <FormFields>
              <FormControlLabel
                control={
                  <Switch
                    name="dormancyAutoDeletion"
                    checked={form.values.locked_cleanup_enabled}
                    onChange={handleToggleLockedCleanup}
                  />
                }
                label="Enable Dormancy Auto-Deletion"
              />
              <TextField
                {...getFieldHelpers(
                  "locked_ttl_ms",
                  <TTLHelperText
                    translationName="dormancyAutoDeletionHelperText"
                    ttl={form.values.locked_ttl_ms}
                  />,
                )}
                disabled={isSubmitting || !form.values.locked_cleanup_enabled}
                fullWidth
                inputProps={{ min: 0, step: "any" }}
                label="Time until deletion (days)"
                type="number"
              />
            </FormFields>
          </FormSection>
        </>
      )}
      {showScheduleDialog && (
        <ScheduleDialog
          onConfirm={() => {
            submitValues()
            setIsScheduleDialogOpen(false)
            // These fields are request-scoped so they should be reset
            // after every submission.
            form
              .setFieldValue("update_workspace_locked_at", false)
              .catch((error) => {
                throw error
              })
            form
              .setFieldValue("update_workspace_last_used_at", false)
              .catch((error) => {
                throw error
              })
          }}
          inactiveWorkspacesToGoDormant={workspacesToDormancyNow.length}
          inactiveWorkspacesToGoDormantInWeek={
            workspacesToDormancyInWeek.length - workspacesToDormancyNow.length
          }
          dormantWorkspacesToBeDeleted={workspacesToBeDeletedNow.length}
          dormantWorkspacesToBeDeletedInWeek={
            workspacesToBeDeletedInWeek.length - workspacesToBeDeletedNow.length
          }
          open={isScheduleDialogOpen}
          onClose={() => {
            setIsScheduleDialogOpen(false)
          }}
          title="Workspace Scheduling"
          updateLockedWorkspaces={(update: boolean) =>
            form.setFieldValue("update_workspace_locked_at", update)
          }
          updateInactiveWorkspaces={(update: boolean) =>
            form.setFieldValue("update_workspace_last_used_at", update)
          }
          dormantValueChanged={
            form.initialValues.inactivity_ttl_ms !==
            form.values.inactivity_ttl_ms
          }
          deletionValueChanged={
            form.initialValues.locked_ttl_ms !== form.values.locked_ttl_ms
          }
        />
      )}

      <FormFooter
        onCancel={onCancel}
        isLoading={isSubmitting}
        submitDisabled={!form.isValid || !form.dirty}
      />
    </HorizontalForm>
  )
}

const useStyles = makeStyles((theme) => ({
  ttlFields: {
    width: "100%",
  },
  optionDescription: {
    fontSize: 12,
    color: theme.palette.text.secondary,
  },
}))
