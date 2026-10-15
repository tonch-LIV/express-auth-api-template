'use strict';

// THIS IS THE STRETCH GOAL ...
// It takes in a schema in the constructor and uses that instead of every collection
// being the same and requiring their own schema. That's not very DRY!

class DataCollection {
  constructor(model) {
    this.model = model;
  }

  async get(id) {
    if (id !== undefined) {
      return this.model.findByPk(id);
    }

    return this.model.findAll();
  }

  async create(data) {
    return this.model.create(data);
  }

  async update(id, data) {
    const record = await this.model.findByPk(id);

    if (!record) {
      return null;
    }

    return record.update(data);
  }

  async delete(id) {
    const record = await this.model.findByPk(id);

    if (!record) {
      return null;
    }

    await record.destroy();
    return {};
  }
}

module.exports = DataCollection;