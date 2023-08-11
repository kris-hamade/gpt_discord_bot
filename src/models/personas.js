const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const PersonaSchema = new Schema({
    name: { type: String, required: true, unique: true },
    type: { type: String, enum: ['wow', 'dnd'] }, // enum is used to ensure that only 'wow' or 'dnd' can be values for type, you can expand this as needed
    description: { type: String },
    mannerisms: { type: String },
    sayings: [{ type: String }], // An array of strings since sayings is an array in the JSON
    generated_phrases: [{ type: String }], // An array of strings since generated_phrases is an array in the JSON
}, { timestamps: true, collection: 'personas' });

module.exports = mongoose.model('Personas', PersonaSchema);
