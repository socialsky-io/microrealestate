import * as Yup from 'yup';

import { Box, Button, Grid } from '@material-ui/core';
import { FieldArray, Form, Formik } from 'formik';
import { Fragment, useCallback, useContext, useMemo } from 'react';

import _ from 'lodash';
import DateField from '../FormFields/DateField';
import moment from 'moment';
import NumberField from '../FormFields/NumberField';
import Section from '../FormFields/Section';
import SelectField from '../FormFields/SelectField';
import { StoreContext } from '../../store';
import SubmitButton from '../FormFields/SubmitButton';
import TextField from '../FormFields/TextField';
import usePaymentTypes from '../../hooks/usePaymentTypes';
import useTranslation from 'next-translate/useTranslation';

const validationSchema = Yup.object().shape({
  payments: Yup.array()
    .of(
      Yup.object().shape({
        amount: Yup.number().min(0),
        date: Yup.mixed().when('amount', {
          is: (val) => val > 0,
          then: Yup.date().required(),
        }),
        type: Yup.mixed()
          .oneOf(['cash', 'transfer', 'levy', 'cheque'])
          .required(),
        reference: Yup.mixed().when('type', {
          is: (val) => val !== 'cash',
          then: Yup.string().required(),
        }),
      })
    )
    .min(1),
});

const emptyPayment = {
  amount: '',
  date: moment(),
  type: 'transfer',
  reference: '',
};

const PaymentForm = ({ onSubmit }) => {
  const { t } = useTranslation('common');
  const store = useContext(StoreContext);
  const paymentTypes = usePaymentTypes();

  const initialValues = useMemo(
    () => ({
      payments: store.rent.selected.payments.length
        ? store.rent.selected.payments.map(
            ({ amount, date, type, reference }) => {
              return {
                amount: amount === 0 ? '' : amount,
                date: date ? moment(date, 'DD/MM/YYYY') : null,
                type: type,
                reference: reference || '',
              };
            }
          )
        : [emptyPayment],
    }),
    [store.rent.selected]
  );

  const _onSubmit = useCallback(
    async (values) => {
      const clonedValues = _.cloneDeep(values);

      const paymentPart = {
        payments: clonedValues.payments
          .filter(({ amount }) => amount > 0)
          .map((payment) => {
            // convert moment into string for the DB
            payment.date = payment.date.format('DD/MM/YYYY');
            if (payment.type === 'cash') {
              delete payment.reference;
            }
            return payment;
          }),
      };
      try {
        await onSubmit(paymentPart);
      } finally {
        // clean fields if empty amounts were saved
        if (clonedValues.payments.length === 0) {
          values.payments = [emptyPayment];
        }
      }
    },
    [onSubmit]
  );

  return (
    <Formik
      initialValues={initialValues}
      validationSchema={validationSchema}
      onSubmit={_onSubmit}
    >
      {({ isSubmitting, values: { payments } }) => {
        return (
          <Form autoComplete="off">
            <Section label={t('Settlements')}>
              <FieldArray name="payments">
                {({ form, ...arrayHelpers }) => {
                  return payments.map((payment, index) => (
                    <Fragment key={index}>
                      <Grid container spacing={2}>
                        <Grid item xs={6}>
                          <NumberField
                            label={t('Amount')}
                            name={`payments[${index}].amount`}
                          />
                        </Grid>
                        <Grid item xs={6}>
                          <DateField
                            label={t('Date')}
                            name={`payments[${index}].date`}
                            minDate={store.rent.period
                              .startOf('month')
                              .toISOString()}
                            maxDate={store.rent.period
                              .endOf('month')
                              .toISOString()}
                          />
                        </Grid>
                      </Grid>
                      <Grid container spacing={2}>
                        <Grid item xs={6}>
                          <SelectField
                            label={t('Type')}
                            name={`payments[${index}].type`}
                            values={paymentTypes.itemList}
                          />
                        </Grid>
                        {payments[index].type !== 'cash' && (
                          <Grid item xs={6}>
                            <TextField
                              label={t('Reference')}
                              name={`payments[${index}].reference`}
                            />
                          </Grid>
                        )}
                      </Grid>
                      <Box
                        pb={2}
                        display="flex"
                        justifyContent={
                          payments.length === index + 1
                            ? 'space-between'
                            : 'flex-end'
                        }
                      >
                        {payments.length === index + 1 && (
                          <Button
                            // variant="contained"
                            color="primary"
                            size="small"
                            onClick={() => arrayHelpers.push(emptyPayment)}
                          >
                            {t('Add a settlement')}
                          </Button>
                        )}
                        {payments.length > 1 && (
                          <Button
                            // variant="contained"
                            color="primary"
                            size="small"
                            onClick={() => arrayHelpers.remove(index)}
                          >
                            {t('Remove the settlement')}
                          </Button>
                        )}
                      </Box>
                    </Fragment>
                  ));
                }}
              </FieldArray>
            </Section>
            <SubmitButton label={!isSubmitting ? t('Save') : t('Saving')} />
          </Form>
        );
      }}
    </Formik>
  );
};

export default PaymentForm;
