import Sequelize from 'sequelize';
import AuditClient from '@packt/audit-sdk';
import Joi from 'joi';
import { URL } from 'url';

import JSONparse from './jsonParse';

/**
 * ServiceModel a helper for Sequelize
 */
export default class ServiceModel {
  /**
   * Constructor for services class. Creates a sequelize object on initialisation
   * @param  {object} config
   * The database config object
   *
   * @return {object}
   * Instance of the service
   */
  constructor(config) {
    if (!ServiceModel.isValidDbConfig(config)) {
      throw new Error('Invalid DB credentials');
    }

    this.db = ServiceModel.createDb(config);

    this.audit = ServiceModel.createAudit(config);

    if (this.getAudit()) {
      this.attachHooks();
    }
  }

  /**
   * Get Sequelize Constructor
   *
   * @return {Object}
   * Sequelize Constructor
   */
  static getSequelize() {
    return Sequelize;
  }

  /**
   * Validates the DB config
   *
   * @param {object} config
   * The config for creating a new DB instance
   *
   * @return {boolean}
   * True/false based on config validity
   */
  static isValidDbConfig(config) {
    const joiConfigSchema = {
      dbName: Joi.string().required(),
      dbUser: Joi.string().required(),
      dbPass: Joi.string().required(),
      dbHost: Joi.string().required(),
      debug: Joi.boolean(),
      userId: Joi.string().guid(),
      auditEs: Joi.string().uri(),
    };

    const joiValidationResult = Joi.validate(config, joiConfigSchema);
    return !joiValidationResult.error;
  }

  /**
   * Function to create the DB connection
   *
   * @param  {object} config
   * variables including db params
   *
   * @return {object}
   * sequelize db object
   */
  static createDb(config) {
    return new Sequelize(config.dbName, config.dbUser, config.dbPass, {
      host: config.dbHost,
      dialect: 'postgres',
      logging: config.debug || false,
    });
  }

  /**
   * Returns instance of the db object
   *
   * @return {object}
   * sequelize db instance
   */
  getDb() {
    return this.db;
  }

  /**
   * Closes the db connection.
   */
  closeDb() {
    this.db.close();
  }

  /**
   * Checks the db connection
   *
   * @return {promise}
   * sequelize promise object
   */
  checkDbConnectivity() {
    return this.db
      .authenticate()
      .catch(() => Promise.reject(new Error('Unable to connect to the database')));
  }

  /**
   * Function to create an Audit Client instance
   *
   * @param {object} config
   * variables including the audit host location
   *
   * @return {object||boolean}
   * Audit client object or false
   */
  static createAudit(config) {
    if (config.auditEs) {
      const auditClient = new AuditClient({ host: config.auditEs });
      auditClient.sequelize.setUserId(config.userId);
      return auditClient;
    }

    return false;
  }

  /**
   * Returns instance of the audit object
   *
   * @return {object||boolean}
   * Audit client instance or false
   */
  getAudit() {
    return this.audit;
  }

  /**
 * Attachs the audit log helpers to the sequelize global hooks
 *
 * @return {void}
 */
  attachHooks() {
    this.db.addHook('afterCreate', (instance, options) => {
      this.audit.sequelize.afterCreate(instance, options);
      return instance;
    });
    this.db.addHook('afterDestroy', (instance, options) => {
      this.audit.sequelize.afterDestroy(instance, options);
      return instance;
    });
    this.db.addHook('beforeBulkDestroy', options => Object.assign(options, { individualHooks: true }));
    this.db.addHook('afterUpdate', (instance, options) => {
      this.audit.sequelize.afterUpdate(instance, options);
      return instance;
    });
    this.db.addHook('beforeBulkUpdate', options => Object.assign(options, { individualHooks: true }));
    this.db.addHook('afterUpsert', (instance, options) => {
      this.audit.sequelize.afterUpsert(instance, options);
      return instance;
    });
  }

  /**
   * Returns an object containing the appropriate pagination links
   * based on the number of results, pageNumber currently accessing and pageSize.
   *
   * @param {object} paginationOptions
   * Pagination options object
   *
   * @param {number} paginationOptions.count
   * The number of results produced from the query
   *
   * @param {number} paginationOptions.offset
   * The results offset currently being accessed
   *
   * @param {number} paginationOptions.limit
   * The size of one page
   *
   * @param {string} paginationOptions.baseLink
   * Link to the endpoint that needs pagination
   * Ex: https://services.packpub.com/offers
   *
   * @return {object}
   * Containing the next and previous links
   */
  static generatePaginationLinks(paginationOptions) {
    const paginationOptionsJoiSchema = {
      count: Joi.number().options({ convert: false }).integer().min(0)
        .required(),
      offset: Joi.number().options({ convert: false }).min(0),
      limit: Joi.number().options({ convert: false }).min(1).required(),
      baseLink: Joi.string().uri({
        scheme: 'https',
      }).required(),
    };

    const validatedPaginationOptions = Joi.validate(paginationOptions, paginationOptionsJoiSchema);

    if (!paginationOptions || validatedPaginationOptions.error) {
      throw new Error('Please provide valid pagination options.');
    }

    const {
      count,
      offset = 0,
      limit,
    } = paginationOptions;

    const baseUrl = new URL(paginationOptions.baseLink);
    const hasResults = count > 0;
    const hasPrev = hasResults && offset >= 1;
    const hasNext = offset < (count - limit);

    const links = {};

    if (hasPrev) {
      const newOffset = offset < limit ? 0 : (offset - limit);
      baseUrl.searchParams.set('offset', newOffset);
      baseUrl.searchParams.set('limit', limit);
      links.prev = baseUrl.toString();
    }

    if (hasNext) {
      const newOffset = offset + limit;
      baseUrl.searchParams.set('offset', newOffset);
      baseUrl.searchParams.set('limit', limit);
      links.next = baseUrl.toString();
    }

    return links;
  }

  /**
   * Parsing a JSON string
   *
   * @param {string} jsonString
   * The JSON string
   *
   * @param {number} [statusCode]
   * The status code to be passed to ErrorCustom
   *
   * @param {number} [errorCode]
   * The error code to be passed to ErrorCustom
   *
   * @return {Promise}
   * Returns the parsed object or an ErrorCustom
   */
  static jsonParse(jsonString, statusCode, errorCode) {
    return JSONparse(jsonString, statusCode, errorCode);
  }
}