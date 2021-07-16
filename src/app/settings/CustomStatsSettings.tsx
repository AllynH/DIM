import {
  customStatsSelector,
  oldAndNewCustomStatsSelector,
  oldCustomTotalSelector,
} from 'app/dim-api/selectors';
import BungieImage from 'app/dim-ui/BungieImage';
import ClassIcon from 'app/dim-ui/ClassIcon';
import { CustomStatWeightsDisplay } from 'app/dim-ui/CustomStatWeights';
import Select from 'app/dim-ui/Select';
import Switch from 'app/dim-ui/Switch';
import { t } from 'app/i18next-t';
import { useD2Definitions } from 'app/manifest/selectors';
import { showNotification } from 'app/notifications/notifications';
import { armorStats, evenStatWeights } from 'app/search/d2-known-values';
import { addIcon, AppIcon, deleteIcon, editIcon, saveIcon } from 'app/shell/icons';
import { chainComparator, compareBy } from 'app/utils/comparators';
import { DestinyClass } from 'bungie-api-ts/destiny2';
import clsx from 'clsx';
import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { v4 as uuidv4 } from 'uuid';
// eslint-disable-next-line css-modules/no-unused-class
import weightsStyles from '../dim-ui/CustomStatWeights.m.scss';
import { simplifyStatLabel } from './custom-stats';
import styles from './CustomStatsSettings.m.scss';
import { useSetSetting } from './hooks';
import { CustomStatDef, CustomStatWeights } from './initial-settings';

// an order for the class dropdown
const classes = [
  DestinyClass.Hunter,
  DestinyClass.Titan,
  DestinyClass.Warlock,
  DestinyClass.Unknown,
];

/**
 * a list of user-defined custom stat displays. each can be switched into editing mode.
 */
export function CustomStatsSettings() {
  const customStatList = useSelector(oldAndNewCustomStatsSelector);
  const [editing, setEditing] = useState('');
  const [weightsMode, setWeightsMode] = useState(false);
  const [provisionalStat, setProvisionalStat] = useState<CustomStatDef>();

  const defs = useD2Definitions();
  if (!defs) {
    return null;
  }

  // provisional stat, if there is one, is displayed above the
  // others in the list, and hasn't been saved to settings yet
  const onAddNew = () => {
    const newStat = createNewStat();
    setProvisionalStat(newStat);
    setEditing(newStat.id);
  };

  // children components call this, to end editing mode
  const onDoneEditing = () => {
    setEditing('');
    setProvisionalStat(undefined);
  };

  return (
    <div className={'setting'}>
      <button
        type="button"
        className={clsx('dim-button', styles.addNew)}
        onClick={onAddNew}
        disabled={Boolean(editing)}
      >
        <AppIcon icon={addIcon} />
      </button>
      {$DIM_FLAVOR === 'dev' && (
        <span className={styles.addNew}>
          dev only: use stat weights{' '}
          <Switch
            checked={weightsMode}
            name="weightsMode"
            onChange={() => setWeightsMode(!weightsMode)}
          />
        </span>
      )}
      <label htmlFor={''}>{t('Settings.CustomStatTitle')}</label>
      <div className={clsx(styles.customDesc, 'fineprint')}>
        {t('Settings.CustomStatDesc1')} {weightsMode && t('Settings.CustomStatDesc2')}{' '}
        {t('Settings.CustomStatDesc3')}
      </div>
      <div className={styles.customStatsSettings}>
        {[...(provisionalStat ? [provisionalStat] : []), ...customStatList].map((c) =>
          c.id === editing ? (
            <CustomStatEditor
              onDoneEditing={onDoneEditing}
              weightsMode={$DIM_FLAVOR === 'dev' && weightsMode}
              statDef={c}
              key={c.id}
            />
          ) : (
            <CustomStatView setEditing={setEditing} statDef={c} key={c.id} />
          )
        )}
      </div>
    </div>
  );
}

/** the editing view for a single custom stat */
function CustomStatEditor({
  statDef,
  className,
  onDoneEditing,
  weightsMode,
}: {
  statDef: CustomStatDef;
  className?: string;
  // used to alert upstream that we are done editing this stat
  onDoneEditing(): void;
  // if false, this editor only lets you toggle each armor stat on and off (weight 0 and weight 1)
  weightsMode: boolean;
}) {
  const defs = useD2Definitions()!;
  const [classType, setClassType] = useState(statDef.class);
  const [label, setLabel] = useState(statDef.label);
  const [weights, setWeight] = useStatWeightsEditor(statDef.weights);
  const saveStat = useSaveStat();
  const removeStat = useRemoveStat();
  const options = classes.map((c) => ({
    key: `${c}`,
    content: <ClassIcon classType={c} />,
    value: c,
  }));
  const onClassChange = ({ target }: React.ChangeEvent<HTMLInputElement>) =>
    setLabel(target.value.slice(0, 30));
  const shortLabel = simplifyStatLabel(label);

  return (
    <div className={clsx(className, styles.customStatEditor)}>
      <div className={styles.identifyingInfo}>
        {/* eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion*/}
        <Select options={options} onChange={(c) => setClassType(c!)} value={classType} />
        <input
          type="text"
          placeholder={t('Settings.CustomName')}
          className={styles.inputlike}
          value={label}
          onChange={onClassChange}
        />
      </div>

      <div className={clsx(styles.editableStatsRow, weightsStyles.statWeightRow)}>
        {armorStats.map((statHash) => {
          const stat = defs.Stat.get(statHash);
          const weight = weights[statHash] || 0;
          const onVal = ({ target }: React.ChangeEvent<HTMLInputElement>) =>
            setWeight(statHash, target.value);

          const className = weight ? 'stat-icon' : styles.zero;
          return (
            <label className={styles.inputlike} key={statHash}>
              <BungieImage
                className={className}
                title={stat.displayProperties.name}
                src={stat.displayProperties.icon}
              />
              {weightsMode ? (
                <input
                  type="number"
                  max={9}
                  min={0}
                  maxLength={30}
                  value={weight}
                  onChange={onVal}
                />
              ) : (
                <Switch
                  name={`${statHash}_toggle`}
                  checked={Boolean(weights[statHash])}
                  onChange={(on) => setWeight(statHash, on ? '1' : '0')}
                />
              )}
            </label>
          );
        })}
      </div>
      <div className={styles.identifyingInfo}>
        <span className={clsx('fineprint', styles.filter)}>
          {shortLabel.length > 0 && (
            <>
              {t('Filter.Filter')}
              {': '}
              <code>{`stat:${shortLabel}:>=30`}</code>
            </>
          )}
        </span>
        <button
          type="button"
          className="dim-button"
          onClick={() => {
            // try saving the proposed new custom stat, with newly set label, class, and weights
            saveStat({ ...statDef, class: classType, label, shortLabel, weights }) &&
              onDoneEditing();
          }}
        >
          <AppIcon icon={saveIcon} />
        </button>
        <button
          type="button"
          className="dim-button danger"
          onClick={() => removeStat(statDef) && onDoneEditing()}
        >
          <AppIcon icon={deleteIcon} />
        </button>
      </div>
    </div>
  );
}

/** a state manager for a single set of stat weights */
function useStatWeightsEditor(w: CustomStatWeights) {
  const [weights, setWeights] = useState(w);
  return [
    weights,
    (statHash: number, value: string) =>
      setWeights((old) => ({ ...old, [statHash]: parseInt(value) || 0 })),
  ] as const;
}

/**
 * the display view for a single stat.
 * it can send a signal upstream to initiate edit mode,
 * replacing itself with CustomStatEditor
 */
function CustomStatView({
  statDef,
  className,
  setEditing,
}: {
  statDef: CustomStatDef;
  className?: string;
  // used to alert upstream that we want to edit this stat
  setEditing: React.Dispatch<React.SetStateAction<string>>;
}) {
  return (
    <div className={clsx(className, styles.customStatView)}>
      <div className={styles.identifyingInfo}>
        <button type="button" className="dim-button" onClick={() => setEditing(statDef.id)}>
          <AppIcon icon={editIcon} />
        </button>
        <ClassIcon proportional className={styles.classIcon} classType={statDef.class} />
        <span className={styles.label}>{statDef.label}</span>
      </div>
      <CustomStatWeightsDisplay customStat={statDef} />
    </div>
  );
}

// custom stat retrieval from state/settings needs to be in a stable order,
// between stat generation (stats.ts) and display (ItemStat.tsx)
// so let's neatly sort them as we commit them to settings.
const customStatSort = chainComparator(
  compareBy((customStat: CustomStatDef) => customStat.class),
  compareBy((customStat: CustomStatDef) => customStat.label)
);

function useSaveStat() {
  const setSetting = useSetSetting();
  const customStatList = useSelector(customStatsSelector);
  const oldCustomTotals = useSelector(oldCustomTotalSelector);

  return (newStat: CustomStatDef) => {
    // when trying to save, update the short label to match the submitted long label
    newStat.shortLabel = simplifyStatLabel(newStat.label);
    const weightValues = Object.values(newStat.weights);

    if (
      // if there's any invalid values
      !weightValues.every((v) => Number.isInteger(v) && v! >= 0) ||
      // or too few included stats
      weightValues.filter(Boolean).length < 2
    ) {
      warnInvalidCustomStat(t('Settings.CustomErrorValues'));
      return false;
    }

    const allOtherStats = customStatList.filter((s) => s.id !== newStat.id);
    if (
      // if there's not enough label
      !newStat.shortLabel ||
      // or there's an existing stat with an overlapping label & class
      allOtherStats.some(
        (s) =>
          s.shortLabel === newStat.shortLabel &&
          (s.class === newStat.class ||
            s.class === DestinyClass.Unknown ||
            newStat.class === DestinyClass.Unknown)
      )
    ) {
      warnInvalidCustomStat(t('Settings.CustomErrorLabel'));
      return false;
    } else {
      // commit this new stat to settings
      setSetting(
        'customStats',
        [...allOtherStats.filter((s) => s.id), newStat].sort(customStatSort)
      );
      // wipe out the old-style custom stat for this class
      setSetting('customTotalStatsByClass', { ...oldCustomTotals, [newStat.class]: [] });
      return true;
    }
  };
}

function useRemoveStat() {
  const setSetting = useSetSetting();
  const customStatList = useSelector(customStatsSelector);
  const oldCustomTotals = useSelector(oldCustomTotalSelector);
  return (stat: CustomStatDef) => {
    if (stat.id.startsWith('__custom__')) {
      // user is deleting a legacy stat
      setSetting('customTotalStatsByClass', { ...oldCustomTotals, [stat.class]: [] });
    } else if (
      // user is deleting a provisional stat, or already cleared out the name field
      stat.label === '' ||
      // user is deleting a full-fledged stat, let's confirm if they are sure
      confirm(t('Settings.CustomDelete'))
    ) {
      setSetting(
        'customStats',
        customStatList.filter((s) => s.id !== stat.id).sort(customStatSort)
      );
      return true;
    }
    return false;
  };
}

function createNewStat(): CustomStatDef {
  return {
    label: '',
    shortLabel: '',
    class: DestinyClass.Unknown,
    weights: { ...evenStatWeights },
    id: uuidv4(),
  };
}

export function normalizeStatLabel(s: string) {
  return s.trim().slice(0, 30);
}

function warnInvalidCustomStat(errorMsg: string) {
  showNotification({
    type: 'warning',
    title: t('dont do that'),
    body: errorMsg,
    duration: 5000,
  });
}