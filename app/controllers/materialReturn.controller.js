import MaterialReturn from '../models/materialReturn.model.js';
import Employee from '../models/employee.model.js';

// Create a new material return
export const createReturn = async (req, res) => {
  try {
    const data = { ...req.body };
    
    // Automatically set employee information from authenticated user session
    data.returnedBy = req.user.username;
    data.employeeName = req.user.name || req.user.username;

    // Look up employee record to get the Employee ID (employeeCode)
    const empRecord = await Employee.findOne({ username: req.user.username }).lean();
    data.employeeCode = empRecord?.employeeCode || '';
    
    // Always default new returns to pending
    data.status = 'pending';

    const newReturn = new MaterialReturn(data);
    await newReturn.save();

    res.status(201).json(newReturn);
  } catch (error) {
    res.status(500).json({ message: 'Failed to create material return', error: error.message });
  }
};

// Retrieve material returns
export const getReturns = async (req, res) => {
  try {
    let query = {};
    
    // Non-admin employees can only view their own returns
    if (req.user.role !== 'admin') {
      query.returnedBy = req.user.username;
    }

    const returns = await MaterialReturn.find(query).sort({ createdAt: -1 });
    res.status(200).json(returns);
  } catch (error) {
    res.status(500).json({ message: 'Failed to retrieve material returns', error: error.message });
  }
};

// Update an existing material return
export const updateReturn = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    const existingReturn = await MaterialReturn.findById(id);
    if (!existingReturn) {
      return res.status(404).json({ message: 'Material return not found' });
    }

    const isAdmin = req.user.role === 'admin';
    const isOwner = existingReturn.returnedBy === req.user.username;

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ message: 'Access denied: You are not authorized to edit this record' });
    }

    // Force non-admin to maintain ownership
    if (!isAdmin) {
      updateData.returnedBy = req.user.username;
      updateData.employeeName = req.user.name || req.user.username;
      const empRecord = await Employee.findOne({ username: req.user.username }).lean();
      updateData.employeeCode = empRecord?.employeeCode || existingReturn.employeeCode || '';
    }

    const updated = await MaterialReturn.findByIdAndUpdate(id, updateData, { new: true });
    res.status(200).json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Failed to update material return', error: error.message });
  }
};

// Delete a material return
export const deleteReturn = async (req, res) => {
  try {
    const { id } = req.params;

    const existingReturn = await MaterialReturn.findById(id);
    if (!existingReturn) {
      return res.status(404).json({ message: 'Material return not found' });
    }

    const isAdmin = req.user.role === 'admin';
    const isOwner = existingReturn.returnedBy === req.user.username;

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ message: 'Access denied: You are not authorized to delete this record' });
    }

    // Verified status check removed

    await MaterialReturn.findByIdAndDelete(id);
    res.status(200).json({ message: 'Material return deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete material return', error: error.message });
  }
};
